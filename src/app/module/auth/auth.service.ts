import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";
import { AuthProvider, Role } from "../../../../generated/prisma/client.js";
import config from "../../config/index.js";
import { verifyGoogleIdToken } from "../../lib/googleAuth.js";
import { transporter } from "../../lib/nodemailer.js";
import { prisma } from "../../lib/prisma.js";
import { redisClient } from "../../lib/redis.js";
import { AppError } from "../../utils/AppError.js";
import { jwtUtils } from "../../utils/jwt.js";
import type {
	IForgotPasswordPayload,
	IGoogleAuthPayload,
	ILoginPayload,
	IRegisterPayload,
	IResetPasswordPayload,
	IVerifyEmailPayload,
} from "./auth.interface.js";

const OTP_TTL_SECONDS = 10 * 60;

const generateOtp = (): string => crypto.randomInt(100000, 1000000).toString();

const generateTokens = (payload: {
	userId: string;
	email: string;
	role: Role;
}) => {
	const accessToken = jwtUtils.createToken(
		payload,
		config.jwt_access_secret,
		config.jwt_access_expires_in,
	);
	const refreshToken = jwtUtils.createToken(
		payload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in,
	);
	return { accessToken, refreshToken };
};

const register = async (payload: IRegisterPayload) => {
	const email = payload.email.trim().toLowerCase();

	const existingUser = await prisma.user.findUnique({ where: { email } });
	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"An account with this email already exists",
		);
	}

	const hashedPassword = await bcrypt.hash(
		payload.password,
		config.bcrypt_salt_rounds,
	);
	const otp = generateOtp();
	const hashedOtp = await bcrypt.hash(otp, config.bcrypt_salt_rounds);

	await redisClient.set(`register-otp:${email}`, hashedOtp, {
		EX: OTP_TTL_SECONDS,
	});
	await redisClient.set(
		`register-data:${email}`,
		JSON.stringify({
			name: payload.name.trim(),
			email,
			password: hashedPassword,
			role: payload.role,
		}),
		{ EX: OTP_TTL_SECONDS },
	);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-otp.ejs",
	);
	const html = await ejs.renderFile(templatePath, {
		name: payload.name,
		email,
		otp,
		expirationMinutes: OTP_TTL_SECONDS / 60,
	});

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Verify your SkillForge account",
		html,
	});
};

const verifyEmail = async (payload: IVerifyEmailPayload) => {
	const email = payload.email.trim().toLowerCase();

	const storedHashedOtp = await redisClient.get(`register-otp:${email}`);
	if (!storedHashedOtp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"OTP has expired or was not requested",
		);
	}

	const isOtpValid = await bcrypt.compare(payload.otp, storedHashedOtp);
	if (!isOtpValid) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}

	const storedData = await redisClient.get(`register-data:${email}`);
	if (!storedData) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Registration session expired, please register again",
		);
	}

	const pending = JSON.parse(storedData) as {
		name: string;
		email: string;
		password: string;
		role: "CANDIDATE" | "COMPANY";
	};

	const user = await prisma.$transaction(
		async (tx) => {
			const newUser = await tx.user.create({
				data: {
					email: pending.email,
					password: pending.password,
					role: pending.role,
					authProvider: AuthProvider.CREDENTIAL,
					emailVerified: true,
				},
			});

			if (pending.role === Role.CANDIDATE) {
				await tx.candidateProfile.create({
					data: { userId: newUser.id, fullName: pending.name },
				});
			} else {
				await tx.companyProfile.create({
					data: { userId: newUser.id, companyName: pending.name },
				});
			}

			return newUser;
		},
		{ maxWait: 10000, timeout: 15000 },
	);

	await redisClient.del(`register-otp:${email}`);
	await redisClient.del(`register-data:${email}`);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/welcome-email.ejs",
	);
	const html = await ejs.renderFile(templatePath, { name: pending.name });
	await transporter.sendMail({
		from: config.email_sender,
		to: user.email,
		subject: "Welcome to SkillForge",
		html,
	});

	const tokens = generateTokens({
		userId: user.id,
		email: user.email,
		role: user.role,
	});
	const { password: _password, ...userWithoutPassword } = user;
	return { user: userWithoutPassword, ...tokens };
};

const login = async (payload: ILoginPayload) => {
	const email = payload.email.trim().toLowerCase();
	const user = await prisma.user.findUnique({ where: { email } });

	if (!user || user.deletedAt) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
	}
	if (!user.isActive) {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been suspended");
	}
	if (!user.password) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account uses Google Sign-In. Please login with Google",
		);
	}

	const isPasswordValid = await bcrypt.compare(payload.password, user.password);
	if (!isPasswordValid) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
	}

	const tokens = generateTokens({
		userId: user.id,
		email: user.email,
		role: user.role,
	});
	const { password: _password, ...userWithoutPassword } = user;
	return { user: userWithoutPassword, ...tokens };
};

const getMe = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: { candidateProfile: true, companyProfile: true },
	});

	if (!user || user.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const { password: _password, ...userWithoutPassword } = user;
	return userWithoutPassword;
};

const refreshAccessToken = async (token: string) => {
	let decoded: { userId: string };
	try {
		decoded = jwtUtils.verifyToken(
			token,
			config.jwt_refresh_secret,
		) as typeof decoded;
	} catch {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired refresh token",
		);
	}

	const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
	if (!user || user.deletedAt || !user.isActive) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User no longer exists or is inactive",
		);
	}

	const accessToken = jwtUtils.createToken(
		{ userId: user.id, email: user.email, role: user.role },
		config.jwt_access_secret,
		config.jwt_access_expires_in,
	);

	return { accessToken };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const email = payload.email.trim().toLowerCase();
	const user = await prisma.user.findUnique({ where: { email } });
	if (!user || user.deletedAt) return;

	if (!user.password) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This account uses Google Sign-In and has no password to reset",
		);
	}

	const otp = generateOtp();
	const hashedOtp = await bcrypt.hash(otp, config.bcrypt_salt_rounds);
	await redisClient.set(`reset-otp:${email}`, hashedOtp, {
		EX: OTP_TTL_SECONDS,
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/forgot-password.ejs",
	);
	const html = await ejs.renderFile(templatePath, {
		otp,
		expirationMinutes: OTP_TTL_SECONDS / 60,
	});
	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Reset your SkillForge password",
		html,
	});
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const email = payload.email.trim().toLowerCase();

	const storedHashedOtp = await redisClient.get(`reset-otp:${email}`);
	if (!storedHashedOtp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"OTP has expired or was not requested",
		);
	}

	const isOtpValid = await bcrypt.compare(payload.otp, storedHashedOtp);
	if (!isOtpValid) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}

	const hashedPassword = await bcrypt.hash(
		payload.newPassword,
		config.bcrypt_salt_rounds,
	);
	await prisma.user.update({
		where: { email },
		data: { password: hashedPassword },
	});
	await redisClient.del(`reset-otp:${email}`);

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/reset-password-success.ejs",
	);
	const html = await ejs.renderFile(templatePath, {});
	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Password Changed",
		html,
	});
};

const googleAuth = async (payload: IGoogleAuthPayload) => {
	const googlePayload = await verifyGoogleIdToken(payload.idToken);
	if (!googlePayload?.email) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid Google token");
	}

	const email = googlePayload.email.trim().toLowerCase();

	let user = await prisma.user.findFirst({
		where: { OR: [{ googleId: googlePayload.sub }, { email }] },
	});

	if (user) {
		if (user.deletedAt)
			throw new AppError(httpStatus.FORBIDDEN, "Your account has been deleted");
		if (!user.isActive)
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your account has been suspended",
			);

		if (!user.googleId) {
			user = await prisma.user.update({
				where: { id: user.id },
				data: { googleId: googlePayload.sub },
			});
		}
	} else {
		if (!payload.role) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Role is required for first-time Google sign-up",
			);
		}
		const role = payload.role;

		const displayName = (googlePayload.name ?? email) as string;

		user = await prisma.$transaction(async (tx) => {
			const newUser = await tx.user.create({
				data: {
					email,
					googleId: googlePayload.sub,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
					role,
				},
			});

			if (role === Role.CANDIDATE) {
				await tx.candidateProfile.create({
					data: { userId: newUser.id, fullName: displayName },
				});
			} else {
				await tx.companyProfile.create({
					data: { userId: newUser.id, companyName: displayName },
				});
			}

			return newUser;
		});

		const templatePath = path.join(
			process.cwd(),
			"src/app/templates/welcome-email.ejs",
		);
		const html = await ejs.renderFile(templatePath, { name: displayName });
		await transporter.sendMail({
			from: config.email_sender,
			to: email,
			subject: "Welcome to SkillForge",
			html,
		});
	}

	const tokens = generateTokens({
		userId: user.id,
		email: user.email,
		role: user.role,
	});
	const { password: _password, ...userWithoutPassword } = user;
	return { user: userWithoutPassword, ...tokens };
};

export const AuthServices = {
	register,
	verifyEmail,
	login,
	getMe,
	refreshAccessToken,
	forgotPassword,
	resetPassword,
	googleAuth,
};
