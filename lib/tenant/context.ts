import type { SessionUser } from "@/lib/auth/session";

// سياق العيادة — يُستخرج من الجلسة حصراً، لا من جسم الطلب أبداً.
// كل استعلام بيانات يجب أن يمر عبر هذا السياق.
export type TenantContext = {
  clinicId: string;
  userId: string;
  role: "DENTIST" | "ASSISTANT";
};

export function tenantContextFromSession(session: SessionUser): TenantContext {
  return {
    clinicId: session.clinicId,
    userId: session.userId,
    role: session.role,
  };
}
