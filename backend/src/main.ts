import express from 'express';
import { config } from './config';
import { log } from './log';
import { getDb, closeDb } from './db';
import { reconcileOnBoot } from './bootstrap/reconcile';
import { profilesRouter } from './modules/profiles/profiles.routes';
import { browserRouter } from './modules/browser/browser.routes';
import { startZombieKiller } from './cron/zombie-killer';

function buildApp(db: ReturnType<typeof getDb>) {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', phase: 2, ts: new Date().toISOString() });
  });

  app.use('/api/profiles', profilesRouter(db));
  app.use('/api/browser', browserRouter(db));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log('error', 'http.unhandled', { err: String(err), stack: err.stack });
    res.status(500).json({ error: 'INTERNAL', message: String(err) });
  });

  return app;
}

function shutdown(signal: string) {
  log('info', 'shutdown', { signal });
  closeDb();
  process.exit(0);
}

async function main() {
  const db = getDb();
  reconcileOnBoot(db);

  const app = buildApp(db);
  app.listen(config.port, '0.0.0.0', () => {
    log('info', 'backend.listening', { port: config.port });
  });

  const stopZombie = startZombieKiller(db);

  process.on('SIGTERM', () => { stopZombie(); shutdown('SIGTERM'); });
  process.on('SIGINT', () => { stopZombie(); shutdown('SIGINT'); });
}

main().catch((err) => {
  log('error', 'bootstrap.failed', { err: String(err), stack: (err as Error)?.stack });
  process.exit(1);
});
