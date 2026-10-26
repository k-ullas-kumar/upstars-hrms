import fs from 'fs';
import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { dialectName, sequelize } from './config/database';
import './models'; // registers models and associations
import { errorHandler, notFoundHandler } from './middleware/error';
import { requestId } from './middleware/requestId';
import { v1Router } from './routes/v1';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Respect X-Forwarded-For (audit IPs) when running behind a proxy.
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: env.frontendOrigins,
      credentials: true,
      exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(requestId);

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, service: 'hrms-backend', status: 'ok', database: dialectName });
  });

  // Generated documents are private: they are only served by the authenticated
  // /api/v1/generated-documents/:id/download route, never from a public static directory.
  app.use('/api/v1', v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function start() {
  fs.mkdirSync(env.storageDir, { recursive: true });
  await sequelize.authenticate();
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`HRMS API listening on http://localhost:${env.port} (db: ${dialectName})`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
