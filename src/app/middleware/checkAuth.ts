import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { Role } from "../../../generated/prisma/client.js";
import config from "../config/index.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { jwtUtils } from "../utils/jwt.js";

export const auth = (...allowedRoles: Role[]) => {
	return catchAsync(
		async (req: Request, _res: Response, next: NextFunction) => {
			const tokenFromCookie = req.cookies?.accessToken;
			const authHeader = req.headers.authorization;
			const tokenFromHeader = authHeader?.startsWith("Bearer ")
				? authHeader.split(" ")[1]
				: undefined;

			const token = tokenFromCookie || tokenFromHeader;

			if (!token) {
				throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized");
			}

			let decoded: { userId: string; email: string; role: Role };
			try {
				decoded = jwtUtils.verifyToken(
					token,
					config.jwt_access_secret,
				) as typeof decoded;
			} catch {
				throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired token");
			}

			if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"You do not have permission to access this resource",
				);
			}

			const user = await prisma.user.findUnique({
				where: { id: decoded.userId },
			});

			if (!user || user.deletedAt) {
				throw new AppError(httpStatus.UNAUTHORIZED, "User no longer exists");
			}
			if (!user.isActive) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"Your account has been suspended",
				);
			}

			req.user = { userId: user.id, email: user.email, role: user.role };
			next();
		},
	);
};
