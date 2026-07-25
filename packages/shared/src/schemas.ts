import { z } from 'zod';
import { MAX_ENTRY_PESEWAS } from './money';
import { isIsoDate } from './businessDate';

// Every request body is validated with one of these before it reaches a
// handler. Coerce nothing silently — reject.

export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits');

export const phoneSchema = z.string().min(9).max(20);

export const shopNameSchema = z.string().trim().min(1).max(60);

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { message: 'expected YYYY-MM-DD' });

const isoDateTime = z.string().datetime({ offset: true });

const amountSchema = z.number().int().min(1).max(MAX_ENTRY_PESEWAS);
const balanceSchema = z.number().int().min(0).max(MAX_ENTRY_PESEWAS);
// A snapshot of expected can legitimately be negative (expenses above sales).
const expectedSchema = z.number().int().min(-MAX_ENTRY_PESEWAS).max(MAX_ENTRY_PESEWAS);

export const entrySchema = z.object({
  id: z.string().uuid(),
  businessDate: isoDateSchema,
  kind: z.enum(['SALE', 'EXPENSE']),
  channel: z.enum(['CASH', 'MOMO']),
  amountPesewas: amountSchema,
  note: z.string().max(200).nullable(),
  createdAtDevice: isoDateTime,
  voidedAt: isoDateTime.nullable(),
  voidReason: z.string().max(200).nullable(),
});

export const dayCloseSchema = z.object({
  id: z.string().uuid(),
  businessDate: isoDateSchema,
  openingCashPesewas: balanceSchema,
  openingMomoPesewas: balanceSchema,
  expectedCashPesewas: expectedSchema,
  expectedMomoPesewas: expectedSchema,
  countedCashPesewas: balanceSchema,
  countedMomoPesewas: balanceSchema,
  closedAt: isoDateTime.nullable(),
});

export const registerBodySchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
  shopName: shopNameSchema,
});

export const loginBodySchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
});

export const deleteMeBodySchema = z.object({
  pin: pinSchema,
});

export const syncRequestSchema = z.object({
  since: isoDateTime.nullable(),
  entries: z.array(entrySchema).max(500),
  dayCloses: z.array(dayCloseSchema).max(500),
});

export type EntryInput = z.infer<typeof entrySchema>;
export type DayCloseInput = z.infer<typeof dayCloseSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;
