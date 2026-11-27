"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
import type { SubscriptionPlanName } from "@/lib/billing/plans";

export type SubscriptionPanelProps = {
  /** انتهت الصلاحية — ترويسة «انتهت التجربة»؛ وإلا ترويسة تجديد مبكر */
  expired: boolean;
  /** رقم حساب شام كاش — من إعدادات المنصة؛ النص يُخفى إن غاب */
  shamCashAccount?: string | null;
  /** إظهار قسم الباركود — الباركود يظهر دائماً، الحساب النصي إن وُجد */
  showShamCash?: boolean;
  /** هل يوجد طلب معلّق؟ — حالة «بانتظار التأكيد» لا تقبل رفع ثانٍ */
  hasPendingRequest: boolean;
};

const PLAN_OPTIONS: SubscriptionPlanName[] = ["MONTHLY", "YEARLY"];

/**
 * لوحة الاشتراك: الأسعار، حساب شام كاش وباركوده، ورفع طلب تفعيل برقم الحوالة.
 * مشتركة بين شاشة الانتهاء (منع كلي) والتجديد المبكر — الحالة تأتي من السيرفر.
 */
export function SubscriptionPanel({
  expired,
  shamCashAccount,
  showShamCash = true,
  hasPendingRequest,
}: SubscriptionPanelProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [plan, setPlan] = useState<SubscriptionPlanName>("MONTHLY");
  const [transferRef, setTransferRef] = useState("");
  const [amount, setAmount] = useState(String(SUBSCRIPTION_PLANS.MONTHLY.priceUsd));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const pending = hasPendingRequest || done;

  function onPlanChange(next: SubscriptionPlanName) {
    setPlan(next);
    setAmount(String(SUBSCRIPTION_PLANS[next].priceUsd));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountUsd = Number(amount);
    if (!transferRef.trim() || !Number.isFinite(amountUsd) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/subscription/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, transferRef: transferRef.trim(), amountUsd }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? t("api.billing.requestFailed"));
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError(t("errors.offline"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-card border border-warm-200 bg-surface-raised p-6 shadow-sm">
      <h2 className="font-display text-xl font-normal text-ink-900">
        {expired ? t("subscription.trialEndedDataSafe") : t("subscription.renew")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-steel-600">
        {expired
          ? t("subscription.dataPreserved")
          : t("subscription.renewBeforeExpiry")}
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-3">
        {PLAN_OPTIONS.map((name) => {
          const spec = SUBSCRIPTION_PLANS[name];
          const selected = plan === name;
          return (
            <li key={name}>
              <button
                type="button"
                onClick={() => onPlanChange(name)}
                className={`focus-ring w-full rounded-field border px-4 py-3 text-center transition-colors ${
                  selected
                    ? "border-primary-600 bg-primary-50"
                    : "border-warm-200 bg-surface hover:bg-surface-hover"
                }`}
              >
                <span className="block text-sm font-semibold text-ink-900">
                  {t("subscription.planUnit")} {spec.label}
                </span>
                <span className="mt-1 block text-2xl font-bold text-primary-700">
                  {spec.priceUsd}$
                </span>
                <span className="mt-1 block text-xs text-steel-500">
                  {spec.durationDays} {t("common.daysAccusative")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {showShamCash && (
        <div className="mt-5 rounded-field border border-warm-200 bg-surface p-4">
          {shamCashAccount && (
            <>
              <p className="text-sm font-semibold text-ink-900">
                {t("subscription.transferViaShamcash")}
              </p>
              <p
                dir="ltr"
                className="mt-1 select-all text-center text-lg font-bold tracking-wide text-primary-700"
              >
                {shamCashAccount}
              </p>
            </>
          )}
          <div className="mt-3 flex flex-col items-center gap-2">
            {/* الباركود الرسمي — أصل ثابت في التطبيق، قابل للمسح بتطبيق شام كاش */}
            <Image
              src="/shamcash-qr.png"
              alt={t("subscription.shamcashBarcode")}
              width={180}
              height={180}
              unoptimized
              className="rounded-field border border-warm-200 bg-white p-1"
            />
            <p className="text-center text-xs text-steel-500">
              {t("subscription.scanOrTransfer")}
            </p>
            <a
              href="/shamcash-qr.png"
              download="shamcash-qr.png"
              className="focus-ring rounded-field border border-warm-300 bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-surface-hover"
            >
              {t("subscription.downloadBarcode")}
            </a>
          </div>
        </div>
      )}

      {pending ? (
        <div
          role="status"
          className="mt-5 rounded-field border border-primary-200 bg-primary-50 p-4 text-center text-sm font-medium text-primary-800"
        >
          {t("subscription.pendingApproval")}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label={t("subscription.shamcashRef")} htmlFor="transfer-ref">
            <Input
              id="transfer-ref"
              value={transferRef}
              onChange={(e) => setTransferRef(e.target.value)}
              placeholder={t("subscription.exampleRef")}
              required
            />
          </Field>
          <Field
            label={t("subscription.transferredAmount")}
            htmlFor="amount"
            hint={t("api.billing.mustMatchPlan")}
          >
            <Input
              id="amount"
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm font-medium text-danger-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting || !transferRef.trim()}
            className="w-full"
          >
            {submitting ? t("subscription.submitting") : t("subscription.submitActivation")}
          </Button>
        </form>
      )}
    </div>
  );
}
