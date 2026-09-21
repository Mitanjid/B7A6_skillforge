import httpStatus from "http-status";
import { Role } from "../../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import type { IUpdateMePayload } from "./user.interface.js";

const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { candidateProfile: true, companyProfile: true },
  });

  if (!user || user.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const { password: _password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

const updateMe = async (
  userId: string,
  role: Role,
  payload: IUpdateMePayload,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (role === Role.CANDIDATE) {
    const updated = await prisma.candidateProfile.update({
      where: { userId },
      data: {
        ...(payload.fullName !== undefined && { fullName: payload.fullName }),
        ...(payload.phone !== undefined && { phone: payload.phone }),
        ...(payload.skills !== undefined && { skills: payload.skills }),
        ...(payload.resumeUrl !== undefined && {
          resumeUrl: payload.resumeUrl,
        }),
      },
    });
    return updated;
  }

  if (role === Role.COMPANY) {
    const updated = await prisma.companyProfile.update({
      where: { userId },
      data: {
        ...(payload.companyName !== undefined && {
          companyName: payload.companyName,
        }),
        ...(payload.website !== undefined && { website: payload.website }),
        ...(payload.industry !== undefined && { industry: payload.industry }),
      },
    });
    return updated;
  }

  throw new AppError(
    httpStatus.BAD_REQUEST,
    "Admin accounts have no profile to update",
  );
};

export const UserServices = {
  getMe,
  updateMe,
};
