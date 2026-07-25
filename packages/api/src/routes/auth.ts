import { Router } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { loginBodySchema, registerBodySchema } from '@daybook/shared/schemas';
import { normalizeGhPhone } from '@daybook/shared/phone';
import { isWeakPin } from '@daybook/shared/pin';
import { ApiError, wrap } from '../lib/errors';
import { hashPin, dummyVerify } from '../lib/pin';
import { checkPinWithLockout } from '../lib/lockout';
import { issueToken, sessionCookie, clearSessionCookie } from '../lib/jwt';
import { RateLimiter } from '../lib/rateLimit';
import type { Config } from '../lib/env';
import type { Logger } from '../lib/logger';

const HOUR = 60 * 60 * 1000;

export function authRoutes(prisma: PrismaClient, config: Config, logger: Logger): Router {
  const router = Router();
  const registerByIp = new RateLimiter(5, HOUR);
  const loginByIp = new RateLimiter(10, HOUR);
  const loginByPhone = new RateLimiter(10, HOUR);
  const secure = config.nodeEnv === 'production';

  const setSession = async (userId: string): Promise<string> =>
    sessionCookie(await issueToken(userId, config.jwtSecret), {
      secure,
      domain: config.cookieDomain,
    });

  router.post(
    '/auth/register',
    wrap(async (req, res) => {
      if (!registerByIp.allow(req.ip ?? 'unknown')) {
        throw new ApiError(429, 'RATE_LIMITED', 'Too many tries. Wait and try again.');
      }
      const parsed = registerBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Check the details and try again.');
      }
      let phone: string;
      try {
        phone = normalizeGhPhone(parsed.data.phone);
      } catch {
        throw new ApiError(400, 'VALIDATION_FAILED', 'That phone number is not right.');
      }
      if (isWeakPin(parsed.data.pin)) {
        throw new ApiError(400, 'WEAK_PIN', 'That PIN is too easy to guess. Choose another.');
      }
      const pinHash = await hashPin(parsed.data.pin);
      try {
        const user = await prisma.user.create({
          data: { phone, pinHash, shopName: parsed.data.shopName },
        });
        res.setHeader('Set-Cookie', await setSession(user.id));
        res.status(201).json({
          user: { id: user.id, phone: user.phone, shopName: user.shopName },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ApiError(
            409,
            'PHONE_TAKEN',
            'That number already has an account. Sign in instead.',
          );
        }
        throw err;
      }
    }),
  );

  router.post(
    '/auth/login',
    wrap(async (req, res) => {
      const parsed = loginBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Check the details and try again.');
      }
      // Identical response and timing for unknown number and wrong PIN.
      const wrongPin = (): ApiError =>
        new ApiError(401, 'PIN_INCORRECT', "That number and PIN don't match. Try again.");

      let phone: string | null = null;
      try {
        phone = normalizeGhPhone(parsed.data.phone);
      } catch {
        phone = null;
      }
      if (
        !loginByIp.allow(req.ip ?? 'unknown') ||
        (phone !== null && !loginByPhone.allow(phone))
      ) {
        throw new ApiError(429, 'RATE_LIMITED', 'Too many tries. Wait and try again.');
      }
      const user = phone
        ? await prisma.user.findUnique({ where: { phone } })
        : null;
      if (!user) {
        await dummyVerify(parsed.data.pin);
        throw wrongPin();
      }
      const check = await checkPinWithLockout(prisma, user, parsed.data.pin);
      if (check === 'locked') {
        throw new ApiError(
          423,
          'ACCOUNT_LOCKED',
          'Too many tries. Wait 15 minutes and try again.',
        );
      }
      if (check === 'wrong') {
        logger.info('login failed', { phoneKnown: true });
        throw wrongPin();
      }
      res.setHeader('Set-Cookie', await setSession(user.id));
      res.json({ user: { id: user.id, phone: user.phone, shopName: user.shopName } });
    }),
  );

  router.post('/auth/logout', (_req, res) => {
    res.setHeader(
      'Set-Cookie',
      clearSessionCookie({ secure, domain: config.cookieDomain }),
    );
    res.status(204).end();
  });

  return router;
}
