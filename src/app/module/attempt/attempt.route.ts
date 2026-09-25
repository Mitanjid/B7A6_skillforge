import { Router } from "express";
import { Role } from "../../../../generated/prisma/client.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AttemptControllers } from "./attempt.controller.js";
import { AttemptValidation } from "./attempt.validation.js";
import { EvaluationControllers } from "../evaluation/evaluation.controller.js";

const router = Router();

router.post(
	"/start",
	auth(Role.CANDIDATE),
	validateRequest(AttemptValidation.startAttemptSchema),
	AttemptControllers.startAttempt,
);

// Must come before "/:id" or "my" would be parsed as an id.
router.get("/my", auth(Role.CANDIDATE), AttemptControllers.getMyAttempts);
router.get("/:id", auth(Role.CANDIDATE), AttemptControllers.getAttemptById);

router.post(
	"/:id/answers",
	auth(Role.CANDIDATE),
	validateRequest(AttemptValidation.submitAnswerSchema),
	AttemptControllers.submitAnswer,
);
router.post(
	"/:id/submit",
	auth(Role.CANDIDATE),
	AttemptControllers.submitAttempt,
);

// Company-side review — separate path, so it doesn't collide with the
// candidate-only "/:id" above.
router.get(
	"/:id/submissions",
	auth(Role.COMPANY),
	EvaluationControllers.getAttemptSubmissions,
);

export const AttemptRoutes = router;
