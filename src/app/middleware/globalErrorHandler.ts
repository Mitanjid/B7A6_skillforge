import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client.js";
import config from "../config/index.js";
import { AppError, type TErrorDetail } from "../utils/AppError.js";

export const globalErrorHandler = (
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	if (config.node_env === "development") {
		console.error("Error:", err);
	}

	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
	let message = "Something went wrong";
	let errors: TErrorDetail[] = [];

	if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
		errors = err.errors;
	} else if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Incorrect field type or missing required field";
	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2002") {
			statusCode = httpStatus.CONFLICT;
			message = "A record with this value already exists";
			errors = [
				{ path: String(err.meta?.target ?? ""), message: "Duplicate value" },
			];
		} else if (err.code === "P2003") {
			statusCode = httpStatus.BAD_REQUEST;
			message = "Foreign key constraint failed";
		} else if (err.code === "P2025") {
			statusCode = httpStatus.NOT_FOUND;
			message = "The requested record was not found";
		}
	} else if (err instanceof Prisma.PrismaClientInitializationError) {
		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
		message = "Could not connect to the database";
	} else if (err instanceof Error) {
		message = err.message;
	}

	res.status(statusCode).json({
		success: false,
		message,
		errors,
		...(config.node_env === "development" &&
			err instanceof Error && { stack: err.stack }),
	});
};
