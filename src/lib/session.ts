// Edge-safe session helpers (no Node-only imports) so middleware can use them.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "od_session";
const SESSION_DAYS = 30;

function secretKey(): Uint8Array {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("APP_SECRET must be set (at least 16 characters)");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { uid: number; role: "admin" | "user" };

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.uid !== "number") return null;
    return { uid: payload.uid, role: payload.role === "admin" ? "admin" : "user" };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https"),
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
