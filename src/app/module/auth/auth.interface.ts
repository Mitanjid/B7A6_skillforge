export interface IRegisterPayload {
	name: string;
	email: string;
	password: string;
	role: "CANDIDATE" | "COMPANY";
}

export interface IVerifyEmailPayload {
	email: string;
	otp: string;
}

export interface ILoginPayload {
	email: string;
	password: string;
}

export interface IGoogleAuthPayload {
	idToken: string;
	role?: "CANDIDATE" | "COMPANY";
}

export interface IForgotPasswordPayload {
	email: string;
}

export interface IResetPasswordPayload {
	email: string;
	otp: string;
	newPassword: string;
}
