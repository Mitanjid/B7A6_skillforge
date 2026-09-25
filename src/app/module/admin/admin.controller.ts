import httpStatus from "http-status";
import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AdminServices } from "./admin.service.js";

const getUsers = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminServices.getUsers(
		req.query as Record<string, unknown>,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Users retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminServices.updateUserStatus(
		req.user!.userId,
		req.params.id as string,
		req.body,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: `User ${result.isActive ? "activated" : "suspended"} successfully`,
		data: result,
	});
});

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminServices.getDashboardStats();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Dashboard stats retrieved successfully",
		data: result,
	});
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminServices.getAuditLogs(
		req.query as Record<string, unknown>,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Audit logs retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

export const AdminControllers = {
	getUsers,
	updateUserStatus,
	getDashboardStats,
	getAuditLogs,
};
