import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { deleteMeBodySchema } from '@daybook/shared/schemas';
import { buildEntriesCsv, csvFilename } from '@daybook/shared/csv';
import type { Entry as WireEntry } from '@daybook/shared/types';
import { ApiError, wrap } from '../lib/errors';
import { requireAuth, getSession } from '../middleware/auth';
import { checkPinWithLockout } from '../lib/lockout';
import { clearSessionCookie } from '../lib/jwt';
import { toIsoDate } from '../lib/dates';
import type { Config } from '../lib/env';

export function meRoutes(prisma: PrismaClient, config: Config): Router {
  const router = Router();
  const auth = requireAuth(config);
  const secure = config.nodeEnv === 'production';

  router.get(
    '/me',
    auth,
    wrap(async (req, res) => {
      const { userId } = getSession(req);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new ApiError(401, 'NOT_AUTHENTICATED', 'Sign in to continue.');
      res.json({
        id: user.id,
        phone: user.phone,
        shopName: user.shopName,
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      });
    }),
  );

  router.get(
    '/me/export',
    auth,
    wrap(async (req, res) => {
      const { userId } = getSession(req);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new ApiError(401, 'NOT_AUTHENTICATED', 'Sign in to continue.');
      const rows = await prisma.entry.findMany({ where: { userId } });
      const entries: WireEntry[] = rows.map((e) => ({
        id: e.id,
        businessDate: toIsoDate(e.businessDate),
        kind: e.kind,
        channel: e.channel,
        amountPesewas: e.amountPesewas,
        note: e.note,
        createdAtDevice: e.createdAtDevice.toISOString(),
        voidedAt: e.voidedAt?.toISOString() ?? null,
        voidReason: e.voidReason,
      }));
      const today = toIsoDate(new Date());
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${csvFilename(user.shopName, today)}"`,
      );
      res.send(buildEntriesCsv(entries));
    }),
  );

  router.delete(
    '/me',
    auth,
    wrap(async (req, res) => {
      const { userId } = getSession(req);
      const parsed = deleteMeBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Type your 4-digit PIN to confirm.');
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new ApiError(401, 'NOT_AUTHENTICATED', 'Sign in to continue.');
      // Same lockout as login — deletion must not be a PIN oracle.
      const check = await checkPinWithLockout(prisma, user, parsed.data.pin);
      if (check === 'locked') {
        throw new ApiError(
          423,
          'ACCOUNT_LOCKED',
          'Too many tries. Wait 15 minutes and try again.',
        );
      }
      if (check === 'wrong') {
        throw new ApiError(401, 'PIN_INCORRECT', 'That PIN is not right.');
      }
      // Real cascading hard delete: entries and dayCloses go with the user row.
      await prisma.user.delete({ where: { id: userId } });
      res.setHeader(
        'Set-Cookie',
        clearSessionCookie({ secure, domain: config.cookieDomain }),
      );
      res.status(204).end();
    }),
  );

  return router;
}
