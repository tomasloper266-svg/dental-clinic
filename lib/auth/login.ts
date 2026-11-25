import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";

// معرف الدخول — username فريد عالمياً، والهاتف فريد لكل عيادة فقط؛ قد يتطابق
// بين عيادتين، لذا نجرب كلمة السر على كل الحسابات المطابقة حتى نجدها.
export async function authenticate(
  identifier: string,
  password: string,
): Promise<SessionUser | null> {
  const users = await prisma.user.findMany({
    where: { OR: [{ username: identifier }, { phone: identifier }] },
  });
  for (const user of users) {
    if (await verifyPassword(password, user.passwordHash)) {
      return {
        userId: user.id,
        clinicId: user.clinicId,
        name: user.name,
        role: user.role,
        lockEnabled: user.lockEnabled,
      };
    }
  }
  return null;
}
