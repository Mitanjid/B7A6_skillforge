import httpStatus from "http-status";
import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { ProblemServices } from "./problem.service.js";

const createProblem = catchAsync(async (req: Request, res: Response) => {
  const result = await ProblemServices.createProblem(
    req.user!.userId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: "Problem created successfully",
    data: result,
  });
});

const getMyProblems = catchAsync(async (req: Request, res: Response) => {
  const result = await ProblemServices.getMyProblems(
    req.user!.userId,
    req.query as Record<string, unknown>,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Problems retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const searchProblems = catchAsync(async (req: Request, res: Response) => {
  const searchTerm = (req.query.q as string) || "";
  const result = await ProblemServices.searchProblems(
    req.user!.userId,
    searchTerm,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Search results retrieved successfully",
    data: result,
  });
});

const getProblemById = catchAsync(async (req: Request, res: Response) => {
  const result = await ProblemServices.getProblemById(
    req.params.id as string,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Problem retrieved successfully",
    data: result,
  });
});

const updateProblem = catchAsync(async (req: Request, res: Response) => {
  const result = await ProblemServices.updateProblem(
    req.params.id as string,
    req.user!.userId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Problem updated successfully",
    data: result,
  });
});

const deleteProblem = catchAsync(async (req: Request, res: Response) => {
  await ProblemServices.deleteProblem(
    req.params.id as string,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: "Problem deleted successfully",
    data: null,
  });
});

export const ProblemControllers = {
  createProblem,
  getMyProblems,
  searchProblems,
  getProblemById,
  updateProblem,
  deleteProblem,
};
