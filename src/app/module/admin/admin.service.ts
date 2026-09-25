import httpStatus from "http-status";
import { PaymentStatus } from "../../../../generated/prisma/client.js";
import type {
  AssessmentStatus,
  AttemptStatus,
  Prisma,
  Role,
} from "../../../../generated/prisma/client.js";
import type { IQuery } from "../../interfaces/index.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import type { IUpdateUserStatusPayload } from "./admin.interface.js";

const USER_SAFE_SELECT = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  emailVerified: true,
  authProvider: true,
  profileImage: true,
  createdAt: true,
  candidateProfile: { select: { fullName: true } },
  companyProfile: { select: { companyName: true } },
} as const;

const getUsers = async (query: IQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (query.role) where.role = query.role as Role;
  if (query.isActive !== undefined) where.isActive = query.isActive === "true";
  if (query.search) {
    where.email = { contains: query.search as string, mode: "insensitive" };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: USER_SAFE_SELECT,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const updateUserStatus = async (
  adminId: string,
  targetUserId: string,
  payload: IUpdateUserStatusPayload,
) => {
  // An admin locking out their own account would be unrecoverable without
  // direct DB access — block it outright rather than trust the caller.
  if (adminId === targetUserId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You cannot change your own account status",
    );
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user || user.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  if (user.isActive === payload.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `This user is already ${payload.isActive ? "active" : "suspended"}`,
    );
  }

  const [updated] = await prisma.$transaction(
    [
      prisma.user.update({
        where: { id: targetUserId },
        data: { isActive: payload.isActive },
        select: USER_SAFE_SELECT,
      }),
      prisma.auditLog.create({
        data: {
          userId: adminId,
          action: payload.isActive ? "USER_ACTIVATED" : "USER_SUSPENDED",
          entityType: "User",
          entityId: targetUserId,
          metadata: { targetEmail: user.email, targetRole: user.role },
        },
      }),
    ],
    { maxWait: 10_000, timeout: 20_000 },
  );

  return updated;
};

const getDashboardStats = async () => {
  const [
    usersByRole,
    assessmentsByStatus,
    attemptsByStatus,
    paymentStats,
    totalProblems,
    totalInvitations,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.assessment.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.attempt.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESS },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.problem.count({ where: { deletedAt: null } }),
    prisma.invitation.count(),
  ]);

  const roleCounts = { CANDIDATE: 0, COMPANY: 0, ADMIN: 0 };
  for (const row of usersByRole) roleCounts[row.role] = row._count._all;

  const assessmentCounts = { DRAFT: 0, PUBLISHED: 0, CLOSED: 0 };
  for (const row of assessmentsByStatus) {
    assessmentCounts[row.status as AssessmentStatus] = row._count._all;
  }

  const attemptCounts = { IN_PROGRESS: 0, SUBMITTED: 0, EVALUATED: 0 };
  for (const row of attemptsByStatus) {
    attemptCounts[row.status as AttemptStatus] = row._count._all;
  }

  return {
    users: {
      candidates: roleCounts.CANDIDATE,
      companies: roleCounts.COMPANY,
      admins: roleCounts.ADMIN,
      total: roleCounts.CANDIDATE + roleCounts.COMPANY + roleCounts.ADMIN,
    },
    assessments: {
      draft: assessmentCounts.DRAFT,
      published: assessmentCounts.PUBLISHED,
      closed: assessmentCounts.CLOSED,
      total:
        assessmentCounts.DRAFT +
        assessmentCounts.PUBLISHED +
        assessmentCounts.CLOSED,
    },
    attempts: {
      inProgress: attemptCounts.IN_PROGRESS,
      submitted: attemptCounts.SUBMITTED,
      evaluated: attemptCounts.EVALUATED,
      total:
        attemptCounts.IN_PROGRESS +
        attemptCounts.SUBMITTED +
        attemptCounts.EVALUATED,
    },
    revenue: {
      totalAmount: paymentStats._sum.amount ?? 0,
      successfulPayments: paymentStats._count._all,
    },
    totalProblems,
    totalInvitations,
  };
};

const getAuditLogs = async (query: IQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};
  if (query.action) {
    where.action = { contains: query.action as string, mode: "insensitive" };
  }
  if (query.userId) where.userId = query.userId as string;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const AdminServices = {
  getUsers,
  updateUserStatus,
  getDashboardStats,
  getAuditLogs,
};
