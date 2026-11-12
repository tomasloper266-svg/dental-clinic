import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";

// الهاتف فريد لكل عيادة وليس عالمياً — قد يتطابق بين عيادتين،
// لذا نجرب كلمة السر على كل الحسابات المطابقة حتى نجدها.
export async function authenticate(
  phone: string,
  password: string,
): Promise<SessionUser | null> {
  const users = await prisma.user.findMany({ where: { phone } });
  for (const user of users) {
    if (await verifyPassword(password, user.passwordHash)) {
      return {
        userId: user.id,
        clinicId: user.clinicId,
        name: user.name,
        role: user.role,
      };
    }
  }
  return null;
}
