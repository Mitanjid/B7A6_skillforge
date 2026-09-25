import httpStatus from "http-status";
import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { EvaluationServices } from "./evaluation.service.js";

const getAttemptSubmissions = catchAsync(
	async (req: Request, res: Response) => {
		const result = await EvaluationServices.getAttemptSubmissions(
			req.user!.userId,
			req.params.id as string,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			message: "Submissions retrieved successfully",
			data: result,
		});
	},
);

const evaluateSubmission = catchAsync(async (req: Request, res: Response) => {
	const result = await EvaluationServices.evaluateSubmission(
		req.user!.userId,
		req.params.id as string,
		req.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Submission evaluated successfully",
		data: result,
	});
});

const getAssessmentResults = catchAsync(async (req: Request, res: Response) => {
	const result = await EvaluationServices.getAssessmentResults(
		req.params.id as string,
		req.user!.userId,
		req.query as Record<string, unknown>,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Results retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const EvaluationControllers = {
	getAttemptSubmissions,
	evaluateSubmission,
	getAssessmentResults,
};
