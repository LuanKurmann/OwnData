import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-friendly reference like OD-7K3M9Q, embedded in e-mail subjects to match replies. */
export function newReference(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `OD-${out}`;
}

export const REFERENCE_REGEX = /OD-[A-HJ-NP-Z2-9]{6}/g;
