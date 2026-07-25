import argon2 from 'argon2';

// argon2id with the parameters fixed in the TRD. The dummy hash keeps timing
// identical for unknown-number and wrong-PIN paths.

const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, OPTIONS);
}

export async function verifyPin(hash: string, pin: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, pin);
  } catch {
    return false;
  }
}

let dummyHash: string | null = null;

/** Burn the same work as a real verify, for requests that must not reveal
 *  whether the account exists. */
export async function dummyVerify(pin: string): Promise<void> {
  dummyHash ??= await argon2.hash('0417', OPTIONS);
  await verifyPin(dummyHash, pin);
}
