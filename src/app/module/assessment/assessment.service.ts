import httpStatus from "http-status";
import {
  AssessmentStatus,
  PaymentStatus,
  type Prisma,
} from "../../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import type { IQuery } from "../../interfaces/index.js";
import type {
  IAttachProblemPayload,
  ICreateAssessmentPayload,
  IUpdateAssessmentPayload,
} from "./assessment.interface.js";

const createAssessment = async (
  companyId: string,
  payload: ICreateAssessmentPayload,
) => {
  const assessment = await prisma.assessment.create({
    data: {
      companyId,
      title: payload.title,
      description: payload.description,
      durationMinutes: payload.durationMinutes,
    },
  });
  return assessment;
};

const getMyAssessments = async (companyId: string, query: IQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.AssessmentWhereInput = { companyId, deletedAt: null };
  if (query.status) where.status = query.status as AssessmentStatus;

  const sortBy = (query.sortBy as string) || "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const [assessments, total] = await Promise.all([
    prisma.assessment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { problems: { include: { problem: true } } },
    }),
    prisma.assessment.count({ where }),
  ]);

  return {
    data: assessments,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getAssessmentById = async (id: string, companyId: string) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      problems: { include: { problem: true }, orderBy: { order: "asc" } },
    },
  });

  if (!assessment || assessment.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Assessment not found");
  }
  if (assessment.companyId !== companyId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have access to this assessment",
    );
  }
  return assessment;
};

const ensureDraft = (assessment: { status: AssessmentStatus }) => {
  if (assessment.status !== AssessmentStatus.DRAFT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only DRAFT assessments can be modified",
    );
  }
};

const updateAssessment = async (
  id: string,
  companyId: string,
  payload: IUpdateAssessmentPayload,
) => {
  const assessment = await getAssessmentById(id, companyId);
  ensureDraft(assessment);

  const updated = await prisma.assessment.update({
    where: { id: assessment.id },
    data: {
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.description !== undefined && {
        description: payload.description,
      }),
      ...(payload.durationMinutes !== undefined && {
        durationMinutes: payload.durationMinutes,
      }),
    },
  });
  return updated;
};

const deleteAssessment = async (id: string, companyId: string) => {
  const assessment = await getAssessmentById(id, companyId);
  ensureDraft(assessment); // can't delete once published — real candidate data may depend on it

  await prisma.assessment.update({
    where: { id: assessment.id },
    data: { deletedAt: new Date() },
  });
};

const attachProblem = async (
  assessmentId: string,
  companyId: string,
  payload: IAttachProblemPayload,
) => {
  const assessment = await getAssessmentById(assessmentId, companyId);
  ensureDraft(assessment);

  const problem = await prisma.problem.findUnique({
    where: { id: payload.problemId },
  });
  if (!problem || problem.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Problem not found");
  }
  if (problem.companyId !== companyId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only attach your own problems",
    );
  }

  const alreadyAttached = await prisma.assessmentProblem.findUnique({
    where: {
      assessmentId_problemId: { assessmentId, problemId: payload.problemId },
    },
  });
  if (alreadyAttached) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This problem is already attached to the assessment",
    );
  }

  const marksToAdd = payload.marks ?? problem.marks;

  const result = await prisma.$transaction(
    async (tx) => {
      // Count inside the same transaction as the create, so two concurrent
      // attach-requests can't both read the same currentCount and assign
      // the same `order` value to two different problems.
      const currentCount = await tx.assessmentProblem.count({
        where: { assessmentId },
      });

      const assessmentProblem = await tx.assessmentProblem.create({
        data: {
          assessmentId,
          problemId: payload.problemId,
          order: payload.order ?? currentCount + 1,
          marks: marksToAdd,
        },
      });

      await tx.assessment.update({
        where: { id: assessmentId },
        data: { totalMarks: { increment: marksToAdd } },
      });

      return assessmentProblem;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );

  return result;
};

const detachProblem = async (
  assessmentId: string,
  problemId: string,
  companyId: string,
) => {
  const assessment = await getAssessmentById(assessmentId, companyId);
  ensureDraft(assessment);

  const assessmentProblem = await prisma.assessmentProblem.findUnique({
    where: { assessmentId_problemId: { assessmentId, problemId } },
  });
  if (!assessmentProblem) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "This problem is not attached to the assessment",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.assessmentProblem.delete({
        where: { assessmentId_problemId: { assessmentId, problemId } },
      });

      await tx.assessment.update({
        where: { id: assessmentId },
        data: { totalMarks: { decrement: assessmentProblem.marks } },
      });
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
};

const publishAssessment = async (id: string, companyId: string) => {
  const assessment = await getAssessmentById(id, companyId);
  ensureDraft(assessment);

  const problemCount = await prisma.assessmentProblem.count({
    where: { assessmentId: id },
  });
  if (problemCount === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot publish an assessment with no problems attached",
    );
  }

  const payment = await prisma.payment.findUnique({
    where: { assessmentId: id },
  });
  if (!payment || payment.status !== PaymentStatus.SUCCESS) {
    throw new AppError(
      httpStatus.PAYMENT_REQUIRED,
      "Payment must be completed before publishing this assessment",
    );
  }

  const updated = await prisma.assessment.update({
    where: { id },
    data: { status: AssessmentStatus.PUBLISHED },
  });
  return updated;
};

const closeAssessment = async (id: string, companyId: string) => {
  const assessment = await getAssessmentById(id, companyId);
  if (assessment.status !== AssessmentStatus.PUBLISHED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only PUBLISHED assessments can be closed",
    );
  }

  const updated = await prisma.assessment.update({
    where: { id },
    data: { status: AssessmentStatus.CLOSED },
  });
  return updated;
};

export const AssessmentServices = {
  createAssessment,
  getMyAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  attachProblem,
  detachProblem,
  publishAssessment,
  closeAssessment,
};