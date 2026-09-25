import { Router } from "express";
import { Role } from "../../../../generated/prisma/client.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AdminControllers } from "./admin.controller.js";
import { AdminValidation } from "./admin.validation.js";

const router = Router();

router.use(auth(Role.ADMIN));

router.get("/users", AdminControllers.getUsers);
router.patch(
	"/users/:id/status",
	validateRequest(AdminValidation.updateUserStatusSchema),
	AdminControllers.updateUserStatus,
);
router.get("/dashboard-stats", AdminControllers.getDashboardStats);
router.get("/audit-logs", AdminControllers.getAuditLogs);

export const AdminRoutes = router;
