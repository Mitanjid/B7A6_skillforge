import { z } from "zod";

const registerSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.email("Invalid email address"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	role: z.enum(["CANDIDATE", "COMPANY"], {
		message: "Role must be CANDIDATE or COMPANY",
	}),
});

const verifyEmailSchema = z.object({
	email: z.email("Invalid email address"),
	otp: z.string().length(6, "OTP must be 6 digits"),
});

const loginSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1, "Refresh token is required"),
});

const forgotPasswordSchema = z.object({
	email: z.email("Invalid email address"),
});

const resetPasswordSchema = z.object({
	email: z.email("Invalid email address"),
	otp: z.string().length(6, "OTP must be 6 digits"),
	newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

const googleAuthSchema = z.object({
	idToken: z.string().min(1, "Google 'idToken' is required"),
	role: z.enum(["CANDIDATE", "COMPANY"]).optional(),
});

export const AuthValidation = {
	registerSchema,
	verifyEmailSchema,
	loginSchema,
	refreshTokenSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
	googleAuthSchema,
};
