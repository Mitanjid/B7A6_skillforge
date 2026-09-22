import httpStatus from "http-status";
import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { UserServices } from "./user.service.js";

const getMe = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getMe(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.updateMe(
    req.user!.userId,
    req.user!.role,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Profile updated successfully",
    data: result,
  });
});

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "No file provided");
  }

  const result = await UserServices.uploadProfileImage(
    req.file.buffer,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Profile image uploaded successfully",
    data: result,
  });
});

export const UserControllers = {
  getMe,
  updateMe,
  uploadProfileImage,
};
