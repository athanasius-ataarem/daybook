import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors';
import { parseCookies, SESSION_COOKIE, verifyToken, type Session } from '../lib/jwt';
import type { Config } from '../lib/env';

export interface AuthedRequest extends Request {
  session?: Session;
  requestId?: string;
}

export function getSession(req: Request): Session {
  const session = (req as AuthedRequest).session;
  if (!session) throw new ApiError(401, 'NOT_AUTHENTICATED', 'Sign in to continue.');
  return session;
}

export function requireAuth(config: Config) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) {
      next(new ApiError(401, 'NOT_AUTHENTICATED', 'Sign in to continue.'));
      return;
    }
    verifyToken(token, config.jwtSecret)
      .then((session) => {
        if (!session) {
          next(new ApiError(401, 'NOT_AUTHENTICATED', 'Sign in to continue.'));
          return;
        }
        (req as AuthedRequest).session = session;
        next();
      })
      .catch(next);
  };
}
