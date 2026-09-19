import { Router } from "express";
import { authLimiter } from "../../middleware/rateLimiter.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AuthControllers } from "./auth.controller.js";
import { AuthValidation } from "./auth.validation.js";

const router = Router();

router.post(
  "/register",
  authLimiter,
  validateRequest(AuthValidation.registerSchema),
  AuthControllers.register,
);
router.post(
  "/verify-email",
  authLimiter,
  validateRequest(AuthValidation.verifyEmailSchema),
  AuthControllers.verifyEmail,
);
router.post(
  "/login",
  authLimiter,
  validateRequest(AuthValidation.loginSchema),
  AuthControllers.login,
);
router.post(
  "/refresh-token",
  validateRequest(AuthValidation.refreshTokenSchema),
  AuthControllers.refreshToken,
);
router.post("/logout", AuthControllers.logout);
router.post(
  "/forgot-password",
  authLimiter,
  validateRequest(AuthValidation.forgotPasswordSchema),
  AuthControllers.forgotPassword,
);
router.post(
  "/reset-password",
  authLimiter,
  validateRequest(AuthValidation.resetPasswordSchema),
  AuthControllers.resetPassword,
);
router.post(
  "/google",
  authLimiter,
  validateRequest(AuthValidation.googleAuthSchema),
  AuthControllers.googleAuth,
);

export const AuthRoutes = router;
