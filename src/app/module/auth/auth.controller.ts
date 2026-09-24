import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config/index.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AuthServices } from "./auth.service.js";

const cookieOptions = {
	httpOnly: true,
	secure: config.node_env === "production",
	sameSite: "lax" as const,
};

const register = catchAsync(async (req: Request, res: Response) => {
	await AuthServices.register(req.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "OTP sent to your email. Please verify to complete registration",
		data: null,
	});
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthServices.verifyEmail(req.body);

	res.cookie("accessToken", result.accessToken, {
		...cookieOptions,
		maxAge: 24 * 60 * 60 * 1000,
	});
	res.cookie("refreshToken", result.refreshToken, {
		...cookieOptions,
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		message: "Email verified, registration complete",
		data: result,
	});
});

const login = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthServices.login(req.body);

	res.cookie("accessToken", result.accessToken, {
		...cookieOptions,
		maxAge: 24 * 60 * 60 * 1000,
	});
	res.cookie("refreshToken", result.refreshToken, {
		...cookieOptions,
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Logged in successfully",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const token = req.cookies?.refreshToken || req.body.refreshToken;
	const result = await AuthServices.refreshAccessToken(token);

	res.cookie("accessToken", result.accessToken, {
		...cookieOptions,
		maxAge: 24 * 60 * 60 * 1000,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Access token refreshed successfully",
		data: result,
	});
});

const logout = catchAsync(async (_req: Request, res: Response) => {
	res.clearCookie("accessToken", cookieOptions);
	res.clearCookie("refreshToken", cookieOptions);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Logged out successfully",
		data: null,
	});
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	await AuthServices.forgotPassword(req.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "If this email is registered, an OTP has been sent",
		data: null,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	await AuthServices.resetPassword(req.body);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Password reset successfully",
		data: null,
	});
});

const googleAuth = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthServices.googleAuth(req.body);

	res.cookie("accessToken", result.accessToken, {
		...cookieOptions,
		maxAge: 24 * 60 * 60 * 1000,
	});
	res.cookie("refreshToken", result.refreshToken, {
		...cookieOptions,
		maxAge: 7 * 24 * 60 * 60 * 1000,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Google authentication successful",
		data: result,
	});
});

export const AuthControllers = {
	register,
	verifyEmail,
	login,
	refreshToken,
	logout,
	forgotPassword,
	resetPassword,
	googleAuth,
};
