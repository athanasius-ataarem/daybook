import { PrismaClient } from '@prisma/client';
import { loadConfig } from './lib/env';
import { createLogger } from './lib/logger';
import { createApp } from './app';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const prisma = new PrismaClient();

const app = createApp(prisma, config, logger);

const server = app.listen(config.port, () => {
  logger.info('api listening', { port: config.port, env: config.nodeEnv });
});

const shutdown = (): void => {
  server.close(() => {
    prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
