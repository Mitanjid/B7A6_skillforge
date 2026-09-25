import { Router } from "express";
import { Role } from "../../../../generated/prisma/client.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { EvaluationControllers } from "./evaluation.controller.js";
import { EvaluationValidation } from "./evaluation.validation.js";

const router = Router();

router.patch(
	"/:id/evaluate",
	auth(Role.COMPANY),
	validateRequest(EvaluationValidation.evaluateSubmissionSchema),
	EvaluationControllers.evaluateSubmission,
);

export const EvaluationRoutes = router;
