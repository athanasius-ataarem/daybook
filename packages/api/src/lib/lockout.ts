import type { PrismaClient, User } from '@prisma/client';
import { verifyPin } from './pin';

// The shared PIN lockout: 15 minutes after 5 consecutive failures, stored on
// the user row so it survives a restart. Every endpoint that verifies a PIN
// (login, account deletion) goes through this — no PIN oracle outside it.

export const LOCK_AFTER_FAILURES = 5;
export const LOCK_MINUTES = 15;

export type PinCheck = 'ok' | 'locked' | 'wrong';

export async function checkPinWithLockout(
  prisma: PrismaClient,
  user: Pick<User, 'id' | 'pinHash' | 'failedLogins' | 'lockedUntil'>,
  pin: string,
  now: Date = new Date(),
): Promise<PinCheck> {
  if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
    return 'locked';
  }
  const good = await verifyPin(user.pinHash, pin);
  if (good) {
    if (user.failedLogins !== 0 || user.lockedUntil !== null) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
    }
    return 'ok';
  }
  const failures = user.failedLogins + 1;
  await prisma.user.update({
    where: { id: user.id },
    data:
      failures >= LOCK_AFTER_FAILURES
        ? {
            failedLogins: 0,
            lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000),
          }
        : { failedLogins: failures },
  });
  return 'wrong';
}
