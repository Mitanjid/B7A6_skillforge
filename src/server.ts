import "dotenv/config";
import dns from "dns";
import type { Server } from "http";
import app from "./app.js";
import config from "./app/config/index.js";
import { redisClient } from "./app/lib/redis.js";
import { AttemptServices } from "./app/module/attempt/attempt.service.js";
import { runSeed } from "./app/utils/seed.js";


dns.setDefaultResultOrder("ipv4first");

let server: Server;
let sweepIntervalId: NodeJS.Timeout;

const main = async () => {
  await redisClient.connect();
  console.log("✅ Redis connected");

  await runSeed();

  // Catches attempts whose time ran out but nobody called /submit — a
  // lazy check also runs on read/answer, this just handles the case where
  // no one ever revisits it. Note: relies on a long-running process, so it
  // only runs when deployed somewhere persistent (e.g. Render), not on
  // stateless serverless invocations (e.g. Vercel functions).
  sweepIntervalId = setInterval(() => {
    AttemptServices.sweepExpiredAttempts().catch((err) => {
      console.error("Attempt sweep failed:", err);
    });
  }, config.attempt_sweep_interval_ms);

  server = app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
  });
};

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received — shutting down gracefully...`);
  clearInterval(sweepIntervalId);

  server?.close(async () => {
    console.log("HTTP server closed");
    try {
      await redisClient.quit();
      console.log("Redis connection closed");
    } catch (err) {
      console.error("Error closing Redis:", err);
    }
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

main();
