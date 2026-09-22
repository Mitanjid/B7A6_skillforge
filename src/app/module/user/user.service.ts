import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { Role } from "../../../../generated/prisma/client.js";
import { cloudinary } from "../../lib/cloudinary.js";
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

  const updatedUser = await prisma.$transaction(
    async (tx) => {
      if (role === Role.CANDIDATE) {
        await tx.candidateProfile.update({
          where: { userId },
          data: {
            ...(payload.fullName !== undefined && {
              fullName: payload.fullName,
            }),
            ...(payload.phone !== undefined && { phone: payload.phone }),
            ...(payload.skills !== undefined && { skills: payload.skills }),
            ...(payload.resumeUrl !== undefined && {
              resumeUrl: payload.resumeUrl,
            }),
          },
        });
      } else if (role === Role.COMPANY) {
        await tx.companyProfile.update({
          where: { userId },
          data: {
            ...(payload.companyName !== undefined && {
              companyName: payload.companyName,
            }),
            ...(payload.website !== undefined && { website: payload.website }),
            ...(payload.industry !== undefined && {
              industry: payload.industry,
            }),
          },
        });
      } else {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Admin accounts have no profile to update",
        );
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: { candidateProfile: true, companyProfile: true },
      });
    },
    { maxWait: 10_000, timeout: 20_000 }, // headroom for Neon cold-start
  );

  const { password: _password, ...result } = updatedUser!;
  return result;
};

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileImagePublicId: true },
  });

  const cloudinaryResult = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { resource_type: "image", folder: "skillforge/profile-images" },
          (error, result) => {
            if (error) return reject(error);
            if (!result)
              return reject(new Error("No result returned from Cloudinary"));
            resolve(result);
          },
        )
        .end(buffer);
    },
  );

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      profileImage: cloudinaryResult.secure_url,
      profileImagePublicId: cloudinaryResult.public_id,
    },
    include: { candidateProfile: true, companyProfile: true },
  });

  if (currentUser?.profileImagePublicId) {
    await cloudinary.uploader.destroy(currentUser.profileImagePublicId);
  }

  const { password: _password, ...result } = updatedUser;
  return result;
};

export const UserServices = {
  getMe,
  updateMe,
  uploadProfileImage,
};
