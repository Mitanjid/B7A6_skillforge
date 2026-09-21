import { Router } from "express";
import { Role } from "../../../../generated/prisma/client.js";
import { auth } from "../../middleware/checkAuth.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { ProblemControllers } from "./problem.controller.js";
import { ProblemValidation } from "./problem.validation.js";

const router = Router();

router.post(
  "/",
  auth(Role.COMPANY),
  validateRequest(ProblemValidation.createProblemSchema),
  ProblemControllers.createProblem,
);
router.get("/search", auth(Role.COMPANY), ProblemControllers.searchProblems);
router.get("/", auth(Role.COMPANY), ProblemControllers.getMyProblems);
router.get("/:id", auth(Role.COMPANY), ProblemControllers.getProblemById);
router.patch(
  "/:id",
  auth(Role.COMPANY),
  validateRequest(ProblemValidation.updateProblemSchema),
  ProblemControllers.updateProblem,
);
router.delete("/:id", auth(Role.COMPANY), ProblemControllers.deleteProblem);

export const ProblemRoutes = router;
