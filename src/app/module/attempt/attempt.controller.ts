import httpStatus from "http-status";
import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AttemptServices } from "./attempt.service.js";

const startAttempt = catchAsync(async (req: Request, res: Response) => {
	const result = await AttemptServices.startAttempt(req.user!.userId, req.body);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		message: "Attempt started successfully",
		data: result,
	});
});

const submitAnswer = catchAsync(async (req: Request, res: Response) => {
	const result = await AttemptServices.submitAnswer(
		req.user!.userId,
		req.params.id as string,
		req.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Answer saved successfully",
		data: result,
	});
});

const submitAttempt = catchAsync(async (req: Request, res: Response) => {
	const result = await AttemptServices.submitAttempt(
		req.user!.userId,
		req.params.id as string,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Attempt submitted successfully",
		data: result,
	});
});

const getAttemptById = catchAsync(async (req: Request, res: Response) => {
	const result = await AttemptServices.getAttemptById(
		req.user!.userId,
		req.params.id as string,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Attempt retrieved successfully",
		data: result,
	});
});

const getMyAttempts = catchAsync(async (req: Request, res: Response) => {
	const result = await AttemptServices.getMyAttempts(
		req.user!.userId,
		req.query as Record<string, unknown>,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Attempts retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const AttemptControllers = {
	startAttempt,
	submitAnswer,
	submitAttempt,
	getAttemptById,
	getMyAttempts,
};
