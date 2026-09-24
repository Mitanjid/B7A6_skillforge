import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client.js";
import config from "../config/index.js";

const adapter = new PrismaPg({ connectionString: config.database_url });

export const prisma = new PrismaClient({ adapter });
