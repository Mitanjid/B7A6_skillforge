import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import morgan from "morgan";

import router from "./app/routes/index.js";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler.js";
import { globalLimiter } from "./app/middleware/rateLimiter.js";
import { notFound } from "./app/middleware/notFound.js";
import config from "./app/config/index.js";

const app: Application = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: config.frontend_url || "*",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(globalLimiter);

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "SkillForge API is running",
    data: { version: "v1" },
  });
});

app.use("/api/v1", router);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
