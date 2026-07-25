import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { dayTotals, expectedCash, expectedMomo } from '@daybook/shared/totals';
import type { TotalableEntry } from '@daybook/shared/totals';

// 14 business days of plausible shop activity for "Mawuli Pharmacy", so the
// History screen and the variance card can be seen in all their states
// without hand-entering data. Deterministic — reseeding gives the same shop.

const prisma = new PrismaClient();

const PHONE = '+233240000000';
const PIN = '4726';
const SHOP = 'Mawuli Pharmacy';

// Small deterministic LCG so the seed is reproducible.
let rngState = 20260725;
function rng(): number {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
function pick<T>(items: readonly T[]): T {
  const item = items[randInt(0, items.length - 1)];
  if (item === undefined) throw new Error('empty pick');
  return item;
}

const SALE_NOTES = [
  null, null, null, null, null, // most sales carry no note
  'Paracetamol carton',
  'Amoxicillin',
  'Blood pressure refill',
  'Baby formula',
  'Malaria test kits',
  'First aid box',
];
const EXPENSE_NOTES = ['fuel', 'transport', 'stock top-up', 'water'] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  // Idempotent: wipe the previous seed user (cascade takes the records).
  await prisma.user.deleteMany({ where: { phone: PHONE } });

  const pinHash = await argon2.hash(PIN, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const user = await prisma.user.create({
    data: { phone: PHONE, pinHash, shopName: SHOP },
  });

  const today = new Date();
  const days: string[] = [];
  for (let i = 14; i >= 1; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    days.push(isoDate(d));
  }

  // Day roles: one mid-fortnight day and the most recent day stay open; one
  // closed day is GHS 25 short on cash, one closed day is GHS 5 over.
  const openMid = days[6];
  const openLast = days[13];
  const shortDay = days[9];
  const overDay = days[3];

  let voidedPlaced = false;
  let lastCounted = { cash: 50_000, momo: 20_000 }; // opening floats for day 1
  let lastClosedIndex = -1;

  const spanEntries: TotalableEntry[] = []; // entries since the last close

  for (let di = 0; di < days.length; di++) {
    const date = days[di];
    if (!date) continue;
    const dayEntries: TotalableEntry[] = [];

    const salesCount = randInt(8, 20);
    for (let s = 0; s < salesCount; s++) {
      const amountPesewas = randInt(5, 450) * 100;
      const channel = rng() < 0.6 ? ('CASH' as const) : ('MOMO' as const);
      const hour = randInt(8, 19);
      const minute = randInt(0, 59);
      const voided = !voidedPlaced && di === 4 && s === 2;
      if (voided) voidedPlaced = true;
      const createdAtDevice = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`);
      const entry = {
        kind: 'SALE' as const,
        channel,
        amountPesewas,
        voidedAt: voided ? new Date(createdAtDevice.getTime() + 60_000).toISOString() : null,
      };
      dayEntries.push(entry);
      await prisma.entry.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          businessDate: new Date(`${date}T00:00:00.000Z`),
          kind: entry.kind,
          channel: entry.channel,
          amountPesewas,
          note: pick(SALE_NOTES),
          createdAtDevice,
          voidedAt: entry.voidedAt ? new Date(entry.voidedAt) : null,
          voidReason: entry.voidedAt ? 'entered twice' : null,
        },
      });
    }

    const expenseCount = randInt(1, 4);
    for (let x = 0; x < expenseCount; x++) {
      const amountPesewas = randInt(5, 120) * 100;
      const channel = rng() < 0.8 ? ('CASH' as const) : ('MOMO' as const);
      const hour = randInt(9, 18);
      const entry = { kind: 'EXPENSE' as const, channel, amountPesewas, voidedAt: null };
      dayEntries.push(entry);
      await prisma.entry.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          businessDate: new Date(`${date}T00:00:00.000Z`),
          kind: entry.kind,
          channel: entry.channel,
          amountPesewas,
          note: pick(EXPENSE_NOTES),
          createdAtDevice: new Date(`${date}T${String(hour).padStart(2, '0')}:30:00.000Z`),
          voidedAt: null,
          voidReason: null,
        },
      });
    }

    spanEntries.push(...dayEntries);

    const leaveOpen = date === openMid || date === openLast;
    if (leaveOpen) continue;

    // Close the day: expected spans everything since the last close, so the
    // gap day folds into the next close exactly as the app computes it.
    const t = dayTotals(spanEntries);
    const expCash = expectedCash(lastCounted.cash, t);
    const expMomo = expectedMomo(lastCounted.momo, t);
    let countedCash = expCash;
    const countedMomo = expMomo;
    if (date === shortDay) countedCash = expCash - 2_500; // GHS 25 short
    if (date === overDay) countedCash = expCash + 500; // GHS 5 over

    await prisma.dayClose.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        businessDate: new Date(`${date}T00:00:00.000Z`),
        openingCashPesewas: lastCounted.cash,
        openingMomoPesewas: lastCounted.momo,
        expectedCashPesewas: expCash,
        expectedMomoPesewas: expMomo,
        countedCashPesewas: countedCash,
        countedMomoPesewas: countedMomo,
        closedAt: new Date(`${date}T19:05:00.000Z`),
      },
    });
    lastCounted = { cash: countedCash, momo: countedMomo };
    lastClosedIndex = di;
    spanEntries.length = 0;
  }

  const closes = await prisma.dayClose.count({ where: { userId: user.id } });
  const entries = await prisma.entry.count({ where: { userId: user.id } });
  console.log(
    `Seeded ${SHOP}: ${entries} entries across 14 days, ${closes} closes ` +
      `(last closed index ${lastClosedIndex}). Login ${PHONE} / PIN ${PIN}.`,
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
