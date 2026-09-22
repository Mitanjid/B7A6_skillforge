import httpStatus from "http-status";
import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AssessmentServices } from "./assessment.service.js";

const createAssessment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssessmentServices.createAssessment(
    req.user!.userId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: "Assessment created successfully",
    data: result,
  });
});

const getMyAssessments = catchAsync(async (req: Request, res: Response) => {
  const result = await AssessmentServices.getMyAssessments(
    req.user!.userId,
    req.query as Record<string, unknown>,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Assessments retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getAssessmentById = catchAsync(async (req: Request, res: Response) => {
  const result = await AssessmentServices.getAssessmentById(
    req.params.id as string,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Assessment retrieved successfully",
    data: result,
  });
});

const updateAssessment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssessmentServices.updateAssessment(
    req.params.id as string,
    req.user!.userId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Assessment updated successfully",
    data: result,
  });
});

const deleteAssessment = catchAsync(async (req: Request, res: Response) => {
  await AssessmentServices.deleteAssessment(
    req.params.id as string,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Assessment deleted successfully",
    data: null,
  });
});

const attachProblem = catchAsync(async (req: Request, res: Response) => {
  const result = await AssessmentServices.attachProblem(
    req.params.id as string,
    req.user!.userId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: "Problem attached successfully",
    data: result,
  });
});

const detachProblem = catchAsync(async (req: Request, res: Response) => {
  await AssessmentServices.detachProblem(
    req.params.id as string,
    req.params.problemId as string,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Problem detached successfully",
    data: null,
  });
});

const publishAssessment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssessmentServices.publishAssessment(
    req.params.id as string,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Assessment published successfully",
    data: result,
  });
});

const closeAssessment = catchAsync(async (req: Request, res: Response) => {
  const result = await AssessmentServices.closeAssessment(
    req.params.id as string,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Assessment closed successfully",
    data: result,
  });
});

export const AssessmentControllers = {
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
