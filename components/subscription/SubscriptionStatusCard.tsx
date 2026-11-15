"use client";

import { SubscriptionPanel } from "./SubscriptionPanel";
import { StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

export type SubscriptionStatusCardProps = {
  /** أيام كاملة متبقية حتى النهاية */
  daysLeft: number;
  /** طول النافذة الحالية — 15 للتجربة أو مدة الباقة المدفوعة */
  totalDays: number;
  /** نسبة التقدم 0–100 */
  pct: number;
  /** في فترة تجربة (لم يُدفع بعد) */
  isTrial: boolean;
  /** رقم حساب شام كاش من إعدادات المنصة — يُخفى إن غاب */
  shamCashAccount?: string | null;
  /** هل يوجد طلب معلّق؟ — يمنع رفع طلب ثانٍ */
  hasPendingRequest: boolean;
};

/**
 * قسم الاشتراك داخل التطبيق (الإعدادات): الحالة وشريط التقدم ثم لوحة
 * الخطط وحوالة شام كاش المشتركة مع شاشة الانتهاء — التمديد المبكر
 * يُضاف إلى نهاية الاشتراك القائم.
 */
export function SubscriptionStatusCard({
  daysLeft,
  totalDays,
  pct,
  isTrial,
  shamCashAccount,
  hasPendingRequest,
}: SubscriptionStatusCardProps) {
  const daysLabel =
    daysLeft <= 0 ? "تنتهي اليوم" : `تبقى ${daysLeft} أيام من ${totalDays}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>الاشتراك</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-steel-600">
          خطة، تجديد وحالة الوصول — تقدر تدفع وتجدد بأي وقت
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <StatusPill tone={isTrial ? "warning" : "success"}>
            {isTrial ? "تجربة نشطة" : "اشتراك قائم"}
          </StatusPill>
          <p className="text-sm font-medium text-ink-900">{daysLabel}</p>
        </div>

        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="تقدم فترة الاشتراك"
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-warm-200"
        >
          <div
            className="h-full rounded-full bg-primary-700 transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-5">
          <SubscriptionPanel
            expired={false}
            shamCashAccount={shamCashAccount}
            hasPendingRequest={hasPendingRequest}
          />
        </div>
      </CardBody>
    </Card>
  );
}
