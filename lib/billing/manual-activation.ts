import { prisma } from "@/lib/db";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
import type { SubscriptionPlanName } from "@/lib/billing/plans";
import { extendedSubscriptionEnd } from "@/lib/billing/state";

// تفعيل يدوي إداري — يضبط subscriptionEndsAt بدون طلب دفع، بنفس قاعدة
// التمدد التراكمي (من نهاية الاشتراك القائم إن كان مستقبلاً، وإلا من اليوم).

export type ManualActivationErrorCode =
  | "invalid-input"
  | "clinic-not-found";

export type ManualActivationOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: ManualActivationErrorCode; message: string } };

function fail<T>(
  code: ManualActivationErrorCode,
  message: string,
): ManualActivationOutcome<T> {
  return { ok: false, error: { code, message } };
}

export type ManualActivationInput = {
  plan: SubscriptionPlanName;
  /** عدد الأشهر (شهرية) أو السنوات (سنوية) — دورات كاملة */
  count: number;
};

/** أعلى عدد دورات مقبول في التفعيل اليدوي — حماية من خطأ إداري فادح */
export const MANUAL_ACTIVATION_MAX_COUNT = 60;

export function parseManualActivationInput(
  body: unknown,
): ManualActivationOutcome<ManualActivationInput> {
  const { plan, count } = (body ?? {}) as { plan?: unknown; count?: unknown };
  if (plan !== "MONTHLY" && plan !== "YEARLY") {
    return fail("invalid-input", "اختر باقة صحيحة");
  }
  if (
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > MANUAL_ACTIVATION_MAX_COUNT
  ) {
    return fail(
      "invalid-input",
      `عدد الدورات يجب أن يكون رقماً صحيحاً من 1 إلى ${MANUAL_ACTIVATION_MAX_COUNT}`,
    );
  }
  return { ok: true, value: { plan, count } };
}

/** تفعيل يدوي — يعيد نهاية الاشتراك الجديدة بعد الضبط التراكمي */
export async function activateClinicManually(
  clinicId: string,
  input: ManualActivationInput,
): Promise<
  ManualActivationOutcome<{ subscriptionEndsAt: Date; clinicName: string }>
> {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, subscriptionEndsAt: true },
  });
  if (!clinic) {
    return fail("clinic-not-found", "العيادة غير موجودة");
  }

  const subscriptionEndsAt = extendedSubscriptionEnd(
    clinic.subscriptionEndsAt,
    input.plan,
    new Date(),
    input.count,
  );
  await prisma.clinic.update({
    where: { id: clinicId },
    data: { subscriptionEndsAt },
  });

  return {
    ok: true,
    value: { subscriptionEndsAt, clinicName: clinic.name },
  };
}

/** تسمية عدد الدورات للعرض — «3 أشهر» أو «سنتان» بلهجة التطبيق */
export function activationCountLabel(plan: SubscriptionPlanName, count: number): string {
  const unit = plan === "MONTHLY" ? "أشهر" : "سنوات";
  return `${count} ${unit} — ${SUBSCRIPTION_PLANS[plan].label}`;
}
