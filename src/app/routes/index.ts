import { Router } from "express";
import { AuthRoutes } from "../module/auth/auth.route.js";
import { UserRoutes } from "../module/user/user.route.js";

const router = Router();

const moduleRoutes = [
  { path: "/auth", route: AuthRoutes },
  { path: "/users", route: UserRoutes },
];

for (const { path, route } of moduleRoutes) {
  router.use(path, route);
}

export default router;
