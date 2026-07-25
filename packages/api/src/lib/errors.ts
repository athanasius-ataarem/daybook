import type { NextFunction, Request, Response } from 'express';
import type { Logger } from './logger';

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'PHONE_TAKEN'
  | 'PIN_INCORRECT'
  | 'ACCOUNT_LOCKED'
  | 'WEAK_PIN'
  | 'NOT_AUTHENTICATED'
  | 'RATE_LIMITED'
  | 'IMMUTABLE_FIELD'
  | 'DUPLICATE_DAY'
  | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Wraps an async handler so a thrown error reaches the error middleware. */
export function wrap(
  fn: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export function errorMiddleware(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = (req as Request & { requestId?: string }).requestId ?? 'r_unknown';
    if (err instanceof ApiError) {
      logger.info('request failed', {
        requestId,
        code: err.code,
        status: err.status,
        path: req.path,
      });
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          requestId,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      });
      return;
    }
    logger.error('unhandled error', {
      requestId,
      path: req.path,
      err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
    res.status(500).json({
      error: { code: 'INTERNAL', message: 'Something went wrong.', requestId },
    });
  };
}
