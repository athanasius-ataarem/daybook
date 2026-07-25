import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { syncRequestSchema } from '@daybook/shared/schemas';
import { ApiError, wrap } from '../lib/errors';
import { requireAuth, getSession } from '../middleware/auth';
import {
  entryImmutableViolations,
  mergeEntryUpdate,
  dayCloseImmutableViolations,
} from '../lib/immutability';
import { businessDateInRange, fromIsoDate, toIsoDate } from '../lib/dates';
import { issueToken, sessionCookie, RENEW_AFTER_SECONDS } from '../lib/jwt';
import type { Config } from '../lib/env';
import type { Logger } from '../lib/logger';

interface Rejected {
  id: string;
  reason: 'IMMUTABLE_FIELD' | 'NOT_FOUND' | 'DUPLICATE_DAY' | 'VALIDATION_FAILED';
  fields?: string[];
}

const PAGE = 500;

function payloadCarriesUserId(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as { entries?: unknown; dayCloses?: unknown };
  for (const list of [b.entries, b.dayCloses]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === 'object' && item !== null && 'userId' in item) return true;
    }
  }
  return false;
}

export function syncRoutes(prisma: PrismaClient, config: Config, logger: Logger): Router {
  const router = Router();
  const secure = config.nodeEnv === 'production';

  router.post(
    '/sync',
    requireAuth(config),
    wrap(async (req, res) => {
      const session = getSession(req);
      const userId = session.userId;

      // Any userId in the payload is ignored, and its presence is logged.
      if (payloadCarriesUserId(req.body)) {
        logger.warn('sync payload carried a userId; ignored', { userId });
      }

      const parsed = syncRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        // Reject the whole request on a schema failure — no partial accepts.
        throw new ApiError(400, 'VALIDATION_FAILED', 'Malformed sync payload.');
      }
      const { since, entries, dayCloses } = parsed.data;
      const rejected: Rejected[] = [];
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        for (const incoming of entries) {
          const stored = await tx.entry.findUnique({ where: { id: incoming.id } });
          if (!stored) {
            if (!businessDateInRange(incoming.businessDate, now)) {
              rejected.push({ id: incoming.id, reason: 'VALIDATION_FAILED' });
              continue;
            }
            await tx.entry.create({
              data: {
                id: incoming.id,
                userId,
                businessDate: fromIsoDate(incoming.businessDate),
                kind: incoming.kind,
                channel: incoming.channel,
                amountPesewas: incoming.amountPesewas,
                note: incoming.note,
                createdAtDevice: new Date(incoming.createdAtDevice),
                voidedAt: incoming.voidedAt ? new Date(incoming.voidedAt) : null,
                voidReason: incoming.voidReason,
              },
            });
            continue;
          }
          if (stored.userId !== userId) {
            // Never reveal that the id exists.
            rejected.push({ id: incoming.id, reason: 'NOT_FOUND' });
            continue;
          }
          const violations = entryImmutableViolations(
            {
              businessDate: toIsoDate(stored.businessDate),
              kind: stored.kind,
              channel: stored.channel,
              amountPesewas: stored.amountPesewas,
              voidedAt: stored.voidedAt,
            },
            incoming,
          );
          if (violations.length > 0) {
            rejected.push({
              id: incoming.id,
              reason: 'IMMUTABLE_FIELD',
              fields: violations,
            });
            continue;
          }
          const merged = mergeEntryUpdate({ voidedAt: stored.voidedAt }, incoming);
          const unchanged =
            stored.note === merged.note &&
            (stored.voidedAt?.getTime() ?? null) === (merged.voidedAt?.getTime() ?? null) &&
            stored.voidReason === merged.voidReason;
          if (!unchanged) {
            await tx.entry.update({ where: { id: incoming.id }, data: merged });
          }
        }
      });

      await prisma.$transaction(async (tx) => {
        for (const incoming of dayCloses) {
          const stored = await tx.dayClose.findUnique({ where: { id: incoming.id } });
          const data = {
            openingCashPesewas: incoming.openingCashPesewas,
            openingMomoPesewas: incoming.openingMomoPesewas,
            expectedCashPesewas: incoming.expectedCashPesewas,
            expectedMomoPesewas: incoming.expectedMomoPesewas,
            countedCashPesewas: incoming.countedCashPesewas,
            countedMomoPesewas: incoming.countedMomoPesewas,
            closedAt: incoming.closedAt ? new Date(incoming.closedAt) : null,
          };
          if (stored) {
            if (stored.userId !== userId) {
              rejected.push({ id: incoming.id, reason: 'NOT_FOUND' });
              continue;
            }
            const violations = dayCloseImmutableViolations(
              { businessDate: toIsoDate(stored.businessDate) },
              incoming,
            );
            if (violations.length > 0) {
              rejected.push({
                id: incoming.id,
                reason: 'IMMUTABLE_FIELD',
                fields: violations,
              });
              continue;
            }
            await tx.dayClose.update({ where: { id: incoming.id }, data });
            continue;
          }
          if (!businessDateInRange(incoming.businessDate, now)) {
            rejected.push({ id: incoming.id, reason: 'VALIDATION_FAILED' });
            continue;
          }
          const byDate = await tx.dayClose.findUnique({
            where: {
              userId_businessDate: {
                userId,
                businessDate: fromIsoDate(incoming.businessDate),
              },
            },
          });
          if (byDate) {
            // Two devices closed the same date under different ids: the
            // incoming close updates the existing row; the incoming id is
            // rejected so the client adopts the surviving row.
            await tx.dayClose.update({ where: { id: byDate.id }, data });
            rejected.push({ id: incoming.id, reason: 'DUPLICATE_DAY' });
            continue;
          }
          await tx.dayClose.create({
            data: {
              id: incoming.id,
              userId,
              businessDate: fromIsoDate(incoming.businessDate),
              ...data,
            },
          });
        }
      });

      // The `since` delta, capped at PAGE per type; hasMore tells the client
      // to immediately page again.
      const sinceDate = since ? new Date(since) : new Date(0);
      const entryRows = await prisma.entry.findMany({
        where: { userId, updatedAt: { gt: sinceDate } },
        orderBy: { updatedAt: 'asc' },
        take: PAGE + 1,
      });
      const closeRows = await prisma.dayClose.findMany({
        where: { userId, updatedAt: { gt: sinceDate } },
        orderBy: { updatedAt: 'asc' },
        take: PAGE + 1,
      });
      const hasMore = entryRows.length > PAGE || closeRows.length > PAGE;

      await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: now } });

      // Renew the cookie if it is more than 7 days old.
      if (now.getTime() / 1000 - session.issuedAt > RENEW_AFTER_SECONDS) {
        res.setHeader(
          'Set-Cookie',
          sessionCookie(await issueToken(userId, config.jwtSecret), {
            secure,
            domain: config.cookieDomain,
          }),
        );
      }

      res.json({
        serverTime: now.toISOString(),
        entries: entryRows.slice(0, PAGE).map((e) => ({
          id: e.id,
          businessDate: toIsoDate(e.businessDate),
          kind: e.kind,
          channel: e.channel,
          amountPesewas: e.amountPesewas,
          note: e.note,
          createdAtDevice: e.createdAtDevice.toISOString(),
          voidedAt: e.voidedAt?.toISOString() ?? null,
          voidReason: e.voidReason,
          updatedAt: e.updatedAt.toISOString(),
        })),
        dayCloses: closeRows.slice(0, PAGE).map((c) => ({
          id: c.id,
          businessDate: toIsoDate(c.businessDate),
          openingCashPesewas: c.openingCashPesewas,
          openingMomoPesewas: c.openingMomoPesewas,
          expectedCashPesewas: c.expectedCashPesewas,
          expectedMomoPesewas: c.expectedMomoPesewas,
          countedCashPesewas: c.countedCashPesewas,
          countedMomoPesewas: c.countedMomoPesewas,
          closedAt: c.closedAt?.toISOString() ?? null,
          updatedAt: c.updatedAt.toISOString(),
        })),
        rejected,
        hasMore,
      });
    }),
  );

  return router;
}
