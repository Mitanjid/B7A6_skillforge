import httpStatus from "http-status";
import {
  AssessmentStatus,
  AttemptStatus,
  InvitationStatus,
  ProblemType,
  type Prisma,
} from "../../../../generated/prisma/client.js";
import type { IQuery } from "../../interfaces/index.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import type {
  IStartAttemptPayload,
  ISubmitAnswerPayload,
} from "./attempt.interface.js";

const startAttempt = async (
  candidateId: string,
  payload: IStartAttemptPayload,
) => {
  const invitation = await prisma.invitation.findUnique({
    where: { id: payload.invitationId },
    include: { assessment: true, attempt: true },
  });
  if (!invitation) {
    throw new AppError(httpStatus.NOT_FOUND, "Invitation not found");
  }
  if (invitation.candidateId !== candidateId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "This invitation does not belong to you",
    );
  }
  if (
    invitation.status === InvitationStatus.PENDING &&
    invitation.expiresAt < new Date()
  ) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.EXPIRED },
    });
    throw new AppError(httpStatus.BAD_REQUEST, "This invitation has expired");
  }
  if (invitation.status !== InvitationStatus.ACCEPTED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Accept this invitation before starting the attempt",
    );
  }
  if (invitation.attempt) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You have already started this assessment",
    );
  }
  if (invitation.assessment.status !== AssessmentStatus.PUBLISHED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This assessment is not currently open for attempts",
    );
  }

  const attempt = await prisma.attempt.create({
    data: {
      invitationId: invitation.id,
      assessmentId: invitation.assessmentId,
      candidateId,
    },
  });

  const assessmentProblems = await prisma.assessmentProblem.findMany({
    where: { assessmentId: invitation.assessmentId },
    orderBy: { order: "asc" },
    include: { problem: true },
  });

  // correctOption is never handed to the candidate.
  const problems = assessmentProblems.map((ap) => ({
    assessmentProblemId: ap.id,
    order: ap.order,
    marks: ap.marks,
    problem: {
      id: ap.problem.id,
      title: ap.problem.title,
      description: ap.problem.description,
      type: ap.problem.type,
      difficulty: ap.problem.difficulty,
      options: ap.problem.options,
    },
  }));

  const deadline = new Date(
    attempt.startedAt.getTime() + invitation.assessment.durationMinutes * 60_000,
  );

  return { attempt, deadline, problems };
};

// Core grading pass — assumes the attempt is currently IN_PROGRESS. Shared by
// the candidate's explicit /submit call, the lazy expiry check on read, and
// the scheduled sweep job, so all three finalize an attempt identically.
const finalizeAttempt = async (attemptId: string) => {
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
  });

  const assessmentProblems = await prisma.assessmentProblem.findMany({
    where: { assessmentId: attempt.assessmentId },
    include: { problem: true },
  });
  const submissions = await prisma.submission.findMany({
    where: { attemptId },
  });
  const submissionByProblem = new Map(submissions.map((s) => [s.problemId, s]));

  let totalScore = 0;
  let hasPendingWritten = false;

  await prisma.$transaction(
    async (tx) => {
      for (const ap of assessmentProblems) {
        const submission = submissionByProblem.get(ap.problemId);

        if (ap.problem.type === ProblemType.MCQ) {
          const isCorrect =
            !!submission && submission.selectedOption === ap.problem.correctOption;
          const score = isCorrect ? ap.marks : 0;
          totalScore += score;

          if (submission) {
            await tx.submission.update({
              where: { id: submission.id },
              data: { isCorrect, score },
            });
          } else {
            // Never answered — record as attempted-but-blank rather than
            // silently omitting it from the results.
            await tx.submission.create({
              data: { attemptId, problemId: ap.problemId, isCorrect: false, score: 0 },
            });
          }
        } else {
          // WRITTEN — always needs a human score.
          if (submission?.score != null) {
            totalScore += submission.score;
          } else {
            hasPendingWritten = true;
            if (!submission) {
              await tx.submission.create({
                data: { attemptId, problemId: ap.problemId },
              });
            }
          }
        }
      }

      await tx.attempt.update({
        where: { id: attemptId },
        data: {
          status: hasPendingWritten
            ? AttemptStatus.SUBMITTED
            : AttemptStatus.EVALUATED,
          submittedAt: new Date(),
          totalScore,
        },
      });
    },
    { maxWait: 10_000, timeout: 20_000 },
  );

  return prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { submissions: true },
  });
};

// Safety net alongside the scheduled sweep — if anything touches an
// IN_PROGRESS attempt past its deadline, finalize it right then instead of
// waiting for the next sweep tick.
const ensureFinalized = async (attempt: {
  id: string;
  status: AttemptStatus;
  startedAt: Date;
}, durationMinutes: number) => {
  if (attempt.status !== AttemptStatus.IN_PROGRESS) return false;
  const deadline = new Date(attempt.startedAt.getTime() + durationMinutes * 60_000);
  if (new Date() > deadline) {
    await finalizeAttempt(attempt.id);
    return true;
  }
  return false;
};

const submitAnswer = async (
  candidateId: string,
  attemptId: string,
  payload: ISubmitAnswerPayload,
) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { assessment: true },
  });
  if (!attempt) {
    throw new AppError(httpStatus.NOT_FOUND, "Attempt not found");
  }
  if (attempt.candidateId !== candidateId) {
    throw new AppError(httpStatus.FORBIDDEN, "This attempt does not belong to you");
  }

  const wasJustFinalized = await ensureFinalized(
    attempt,
    attempt.assessment.durationMinutes,
  );
  if (wasJustFinalized || attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Time is up — this attempt has already been submitted",
    );
  }

  const assessmentProblem = await prisma.assessmentProblem.findUnique({
    where: {
      assessmentId_problemId: {
        assessmentId: attempt.assessmentId,
        problemId: payload.problemId,
      },
    },
    include: { problem: true },
  });
  if (!assessmentProblem) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "This problem is not part of this assessment",
    );
  }

  const isMcq = assessmentProblem.problem.type === ProblemType.MCQ;
  if (isMcq && !payload.selectedOption) {
    throw new AppError(httpStatus.BAD_REQUEST, "selectedOption is required for this problem");
  }
  if (!isMcq && !payload.answerText) {
    throw new AppError(httpStatus.BAD_REQUEST, "answerText is required for this problem");
  }

  const submission = await prisma.submission.upsert({
    where: {
      attemptId_problemId: { attemptId, problemId: payload.problemId },
    },
    create: {
      attemptId,
      problemId: payload.problemId,
      selectedOption: payload.selectedOption,
      answerText: payload.answerText,
    },
    update: {
      selectedOption: payload.selectedOption,
      answerText: payload.answerText,
    },
  });

  return submission;
};

const submitAttempt = async (candidateId: string, attemptId: string) => {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) {
    throw new AppError(httpStatus.NOT_FOUND, "Attempt not found");
  }
  if (attempt.candidateId !== candidateId) {
    throw new AppError(httpStatus.FORBIDDEN, "This attempt does not belong to you");
  }
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This attempt has already been submitted",
    );
  }

  return finalizeAttempt(attemptId);
};

const getAttemptById = async (candidateId: string, attemptId: string) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { assessment: { select: { title: true, durationMinutes: true } } },
  });
  if (!attempt) {
    throw new AppError(httpStatus.NOT_FOUND, "Attempt not found");
  }
  if (attempt.candidateId !== candidateId) {
    throw new AppError(httpStatus.FORBIDDEN, "This attempt does not belong to you");
  }

  await ensureFinalized(attempt, attempt.assessment.durationMinutes);

  return prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      submissions: true,
      assessment: { select: { title: true, durationMinutes: true } },
    },
  });
};

const getMyAttempts = async (candidateId: string, query: IQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.AttemptWhereInput = { candidateId };
  if (query.status) where.status = query.status as AttemptStatus;

  const [attempts, total] = await Promise.all([
    prisma.attempt.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startedAt: "desc" },
      include: { assessment: { select: { id: true, title: true } } },
    }),
    prisma.attempt.count({ where }),
  ]);

  return {
    data: attempts,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Scheduled sweep — see server.ts. Catches attempts nobody ever revisited
// after time ran out (ensureFinalized only fires on access).
const sweepExpiredAttempts = async () => {
  const inProgress = await prisma.attempt.findMany({
    where: { status: AttemptStatus.IN_PROGRESS },
    include: { assessment: { select: { durationMinutes: true } } },
  });

  const now = Date.now();
  const expired = inProgress.filter(
    (a) => now - a.startedAt.getTime() > a.assessment.durationMinutes * 60_000,
  );

  for (const attempt of expired) {
    try {
      await finalizeAttempt(attempt.id);
    } catch (err) {
      console.error(`Failed to auto-submit expired attempt ${attempt.id}:`, err);
    }
  }

  if (expired.length) {
    console.log(`⏱️  Auto-submitted ${expired.length} expired attempt(s)`);
  }
};

export const AttemptServices = {
  startAttempt,
  submitAnswer,
  submitAttempt,
  getAttemptById,
  getMyAttempts,
  sweepExpiredAttempts,
};
