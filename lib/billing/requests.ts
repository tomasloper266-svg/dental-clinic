import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { planPriceUsd } from "@/lib/billing/plans";
import { extendedSubscriptionEnd } from "@/lib/billing/state";

// طلبات التفعيل بحوالة شام كاش — الرفع من صفحة الاشتراك، والقرار (اعتماد/رفض)
// من لوحة إدارة المنصة حصراً. الاعتماد وحده يمدد الاشتراك تراكمياً.

export type PaymentRequestErrorCode =
  | "invalid-input"
  | "amount-mismatch"
  | "pending-exists"
  | "transfer-ref-used"
  | "not-pending";

export type PaymentOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: PaymentRequestErrorCode; message: string } };

function fail<T>(code: PaymentRequestErrorCode, message: string): PaymentOutcome<T> {
  return { ok: false, error: { code, message } };
}

export type PaymentRequestInput = {
  plan: "MONTHLY" | "YEARLY";
  transferRef: string;
  /** المبلغ المُحوَّل كما أقرّه الطبيب — يجب أن يطابق سعر الباقة */
  amountUsd: number;
};

export function parsePaymentRequestInput(body: unknown): PaymentOutcome<PaymentRequestInput> {
  const { plan, transferRef, amountUsd } = (body ?? {}) as {
    plan?: unknown;
    transferRef?: unknown;
    amountUsd?: unknown;
  };
  if (plan !== "MONTHLY" && plan !== "YEARLY") {
    return fail("invalid-input", "اختر باقة صحيحة");
  }
  if (typeof transferRef !== "string" || !transferRef.trim()) {
    return fail("invalid-input", "أدخل رقم حوالة شام كاش");
  }
  if (transferRef.trim().length > 100) {
    return fail("invalid-input", "رقم الحوالة طويل جداً");
  }
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return fail("invalid-input", "أدخل المبلغ المُحوَّل");
  }
  return {
    ok: true,
    value: { plan, transferRef: transferRef.trim(), amountUsd },
  };
}

/** رفع طلب تفعيل — يُرفض إن وُجد طلب قيد المراجعة أو حوالة معتمدة سابقاً أو مبلغ غير مطابق */
export async function createPaymentRequest(
  clinicId: string,
  input: PaymentRequestInput,
): Promise<PaymentOutcome<{ id: string }>> {
  // المبلغ يجب أن يطابق سعر الباقة الرسمي — حماية من تحويل بمبلغ خاطئ
  if (input.amountUsd !== planPriceUsd(input.plan)) {
    return fail(
      "amount-mismatch",
      `المبلغ المُحوَّل لا يطابق سعر الباقة (${planPriceUsd(input.plan)}$)`,
    );
  }

  const pending = await prisma.subscriptionPayment.findFirst({
    where: { clinicId, status: "PENDING" },
    select: { id: true },
  });
  if (pending) {
    return fail("pending-exists", "لديك طلب قيد المراجعة — بانتظار التأكيد");
  }

  // الفهرس الجزئي يفرض التفرد بين الصفوف المعتمدة فقط — رفع رقم معتمد
  // سابقاً كطلب PENDING جديد لا يطابق شرطه فيمرّ. الفحص الصريح هنا هو
  // الحاجز الأول، والفهرس يبقى حاجز السباق عند الاعتماد المتوازي.
  const approvedRef = await prisma.subscriptionPayment.findFirst({
    where: { transferRef: input.transferRef, status: "APPROVED" },
    select: { id: true },
  });
  if (approvedRef) {
    return fail(
      "transfer-ref-used",
      "رقم الحوالة مستخدم في طلب معتمد سابقاً — أدخل رقم الحوالة الصحيح",
    );
  }

  try {
    const created = await prisma.subscriptionPayment.create({
      data: {
        clinicId,
        plan: input.plan,
        amountUsd: new Prisma.Decimal(input.amountUsd),
        transferRef: input.transferRef,
      },
      select: { id: true },
    });
    return { ok: true, value: { id: created.id } };
  } catch (err) {
    // الفهرس الجزئي على transferRef (المدفوعات المعتمدة) — حاجز إعادة
    // استخدام الحوالة الأخير تحت فحص الطلب المعلّق.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return fail(
        "transfer-ref-used",
        "رقم الحوالة مستخدم في طلب معتمد سابقاً — أدخل رقم الحوالة الصحيح",
      );
    }
    throw err;
  }
}

/** اعتماد طلب — يمدد الاشتراك تراكمياً من max(now، النهاية الحالية) */
export async function approvePaymentRequest(
  paymentId: string,
  note?: string,
): Promise<PaymentOutcome<{ subscriptionEndsAt: Date | null }>> {
  return decidePaymentRequest(paymentId, "APPROVED", note);
}

/** رفض طلب — يُسجل السبب ويبقى الاشتراك كما هو */
export async function rejectPaymentRequest(
  paymentId: string,
  note?: string,
): Promise<PaymentOutcome<{ id: string }>> {
  const result = await decidePaymentRequest(paymentId, "REJECTED", note);
  return result.ok ? { ok: true, value: { id: paymentId } } : result;
}

type Decision = "APPROVED" | "REJECTED";

async function decidePaymentRequest(
  paymentId: string,
  decision: Decision,
  note: string | undefined,
): Promise<PaymentOutcome<{ subscriptionEndsAt: Date | null }>> {
  const now = new Date();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.findUnique({
        where: { id: paymentId },
      });
      if (!payment || payment.status !== "PENDING") return null;

      const clinic = await tx.clinic.findUniqueOrThrow({
        where: { id: payment.clinicId },
        select: { subscriptionEndsAt: true },
      });

      await tx.subscriptionPayment.update({
        where: { id: paymentId },
        data: { status: decision, decidedAt: now, note },
      });

      // الاعتماد وحده يمدد — التمديد من نهاية الاشتراك القائم إن كان مستقبلاً
      const subscriptionEndsAt =
        decision === "APPROVED"
          ? extendedSubscriptionEnd(clinic.subscriptionEndsAt, payment.plan, now)
          : clinic.subscriptionEndsAt;
      if (decision === "APPROVED") {
        await tx.clinic.update({
          where: { id: payment.clinicId },
          data: { subscriptionEndsAt },
        });
      }
      return { subscriptionEndsAt };
    });
    if (!result) {
      return fail("not-pending", "الطلب ليس قيد المراجعة — ربما حُسم مسبقاً");
    }
    return { ok: true, value: result };
  } catch (err) {
    // حوالة اعتُمدت في طلب آخر بالتوازي — الفهرس الجزئي يمنع التكرار
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return fail("transfer-ref-used", "رقم الحوالة مستخدم في طلب معتمد سابقاً");
    }
    throw err;
  }
}
