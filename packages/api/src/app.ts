import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import type { PrismaClient } from '@prisma/client';
import type { Config } from './lib/env';
import type { Logger } from './lib/logger';
import { errorMiddleware } from './lib/errors';
import { requestId } from './middleware/requestId';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { syncRoutes } from './routes/sync';

export function createApp(prisma: PrismaClient, config: Config, logger: Logger) {
  const app = express();
  app.set('trust proxy', 'loopback'); // nginx sits in front on the same box
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'self'"] },
      },
    }),
  );
  app.use(cors({ origin: config.appOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId(logger));

  const api = express.Router();

  api.get('/health', (_req, res) => {
    prisma
      .$queryRaw`SELECT 1`.then(() => res.json({ ok: true, db: true }))
      .catch(() => res.status(503).json({ ok: false, db: false }));
  });

  api.use(authRoutes(prisma, config, logger));
  api.use(meRoutes(prisma, config));
  api.use(syncRoutes(prisma, config, logger));

  app.use('/api', api);
  app.use(errorMiddleware(logger));
  return app;
}
