import 'dotenv/config';
import app from './app.js';
import config from './app/config/index.js';
import { redisClient } from './app/lib/redis.js';
import { runSeed } from './app/utils/seed.js';

const main = async () => {
  await redisClient.connect();
  console.log('✅ Redis connected');

  await runSeed();

  app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
  });
};

main();
