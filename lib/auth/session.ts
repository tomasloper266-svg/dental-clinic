import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";

// جلسات مخزّنة في القاعدة: الكوكي يحمل توكيناً عشوائياً، والقاعدة تحتفظ بهاشه فقط.
export const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // أسبوعان

export type SessionUser = {
  userId: string;
  clinicId: string;
  name: string;
  role: "DENTIST" | "ASSISTANT";
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

// تنظيف كسول للجلسات المنتهية عند إنشاء جلسة جديدة.
export async function purgeExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export async function getSessionUser(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return {
    userId: session.user.id,
    clinicId: session.user.clinicId,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
