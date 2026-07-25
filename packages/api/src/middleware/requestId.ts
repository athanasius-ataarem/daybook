import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../lib/logger';

export function requestId(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = `r_${randomUUID().slice(0, 8)}`;
    (req as Request & { requestId: string }).requestId = id;
    const started = Date.now();
    res.on('finish', () => {
      logger.info('request', {
        requestId: id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  };
}
