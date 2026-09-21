import httpStatus from "http-status";
import type { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import type { IQuery } from "../../interfaces/index.js";
import type {
  ICreateProblemPayload,
  IUpdateProblemPayload,
} from "./problem.interface.js";

const createProblem = async (
  companyId: string,
  payload: ICreateProblemPayload,
) => {
  const problem = await prisma.problem.create({
    data: {
      companyId,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      difficulty: payload.difficulty,
      tags: payload.tags ?? [],
      options: payload.options
        ? (payload.options as unknown as Prisma.InputJsonValue)
        : undefined,
      correctOption: payload.correctOption,
      marks: payload.marks ?? 10,
    },
  });

  return problem;
};

const getMyProblems = async (companyId: string, query: IQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.ProblemWhereInput = {
    companyId,
    deletedAt: null,
  };

  if (query.type) {
    where.type = query.type as Prisma.EnumProblemTypeFilter["equals"];
  }

  if (query.difficulty) {
    where.difficulty =
      query.difficulty as Prisma.EnumDifficultyFilter["equals"];
  }

  const sortBy = (query.sortBy as string) || "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const [problems, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    }),

    prisma.problem.count({ where }),
  ]);

  return {
    data: problems,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const searchProblems = async (companyId: string, searchTerm: string) => {
  const problems = await prisma.problem.findMany({
    where: {
      companyId,
      deletedAt: null,
      OR: [
        {
          title: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          tags: {
            has: searchTerm,
          },
        },
      ],
    },
  });

  return problems;
};

const getProblemById = async (id: string, companyId: string) => {
  const problem = await prisma.problem.findUnique({
    where: { id },
  });

  if (!problem || problem.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "Problem not found");
  }

  if (problem.companyId !== companyId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have access to this problem",
    );
  }

  return problem;
};

const updateProblem = async (
  id: string,
  companyId: string,
  payload: IUpdateProblemPayload,
) => {
  const problem = await getProblemById(id, companyId);

  const updated = await prisma.problem.update({
    where: { id: problem.id },
    data: {
      ...(payload.title !== undefined && {
        title: payload.title,
      }),

      ...(payload.description !== undefined && {
        description: payload.description,
      }),

      ...(payload.type !== undefined && {
        type: payload.type,
      }),

      ...(payload.difficulty !== undefined && {
        difficulty: payload.difficulty,
      }),

      ...(payload.tags !== undefined && {
        tags: payload.tags,
      }),

      ...(payload.options !== undefined && {
        options: payload.options as unknown as Prisma.InputJsonValue,
      }),

      ...(payload.correctOption !== undefined && {
        correctOption: payload.correctOption,
      }),

      ...(payload.marks !== undefined && {
        marks: payload.marks,
      }),
    },
  });

  return updated;
};

const deleteProblem = async (id: string, companyId: string) => {
  const problem = await getProblemById(id, companyId);

  await prisma.problem.update({
    where: { id: problem.id },
    data: {
      deletedAt: new Date(),
    },
  });
};

export const ProblemServices = {
  createProblem,
  getMyProblems,
  searchProblems,
  getProblemById,
  updateProblem,
  deleteProblem,
};
