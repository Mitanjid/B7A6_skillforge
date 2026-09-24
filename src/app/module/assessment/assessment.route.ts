import { Router } from "express";
import { Role } from "../../../../generated/prisma/client.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AssessmentControllers } from "./assessment.controller.js";
import { AssessmentValidation } from "./assessment.validation.js";

const router = Router();

router.post(
	"/",
	auth(Role.COMPANY),
	validateRequest(AssessmentValidation.createAssessmentSchema),
	AssessmentControllers.createAssessment,
);
router.get("/", auth(Role.COMPANY), AssessmentControllers.getMyAssessments);
router.get("/:id", auth(Role.COMPANY), AssessmentControllers.getAssessmentById);
router.patch(
	"/:id",
	auth(Role.COMPANY),
	validateRequest(AssessmentValidation.updateAssessmentSchema),
	AssessmentControllers.updateAssessment,
);
router.delete(
	"/:id",
	auth(Role.COMPANY),
	AssessmentControllers.deleteAssessment,
);

router.post(
	"/:id/problems",
	auth(Role.COMPANY),
	validateRequest(AssessmentValidation.attachProblemSchema),
	AssessmentControllers.attachProblem,
);
router.delete(
	"/:id/problems/:problemId",
	auth(Role.COMPANY),
	AssessmentControllers.detachProblem,
);

router.patch(
	"/:id/publish",
	auth(Role.COMPANY),
	AssessmentControllers.publishAssessment,
);
router.patch(
	"/:id/close",
	auth(Role.COMPANY),
	AssessmentControllers.closeAssessment,
);

export const AssessmentRoutes = router;
