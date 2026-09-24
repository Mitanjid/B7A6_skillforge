import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { ZodObject } from "zod";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";

export const validateRequest = (zodSchema: ZodObject) => {
	return catchAsync((req: Request, _res: Response, next: NextFunction) => {
		const result = zodSchema.safeParse(req.body ?? {});

		if (!result.success) {
			const errors = result.error.issues.map((issue) => ({
				path: issue.path.join("."),
				message: issue.message,
			}));
			throw new AppError(httpStatus.BAD_REQUEST, "Validation failed", errors);
		}

		req.body = result.data;
		next();
	});
};
