import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route.js";
import { UserRoutes } from "../module/user/user.route.js";
import { ProblemRoutes } from "../module/problem/problem.route.js";
import { AssessmentRoutes } from "../module/assessment/assessment.route.js";

const router = Router();

const moduleRoutes = [
  { path: "/auth", route: AuthRoutes },
  { path: "/users", route: UserRoutes },
  { path: "/problems", route: ProblemRoutes },
  { path: "/assessments", route: AssessmentRoutes },
];

for (const { path, route } of moduleRoutes) {
  router.use(path, route);
}

export default router;
