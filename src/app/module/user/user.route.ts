import { Router } from "express";
import { Role } from "../../../../generated/prisma/client.js";
import { auth } from "../../middleware/checkAuth.js";
import { upload } from "../../lib/multer.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { UserControllers } from "./user.controller.js";
import { UserValidation } from "./user.validation.js";

const router = Router();

router.get(
  "/me",
  auth(Role.CANDIDATE, Role.COMPANY, Role.ADMIN),
  UserControllers.getMe,
);
router.patch(
  "/me",
  auth(Role.CANDIDATE, Role.COMPANY),
  validateRequest(UserValidation.updateMeSchema),
  UserControllers.updateMe,
);
router.post(
  "/me/profile-image",
  auth(Role.CANDIDATE, Role.COMPANY, Role.ADMIN),
  upload.single("profileImage"),
  UserControllers.uploadProfileImage,
);

export const UserRoutes = router;
