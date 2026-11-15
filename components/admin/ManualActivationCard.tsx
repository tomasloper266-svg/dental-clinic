"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
import type { SubscriptionPlanName } from "@/lib/billing/plans";
import type { AdminClinicRow } from "./AdminBoard";

const PLAN_OPTIONS: SubscriptionPlanName[] = ["MONTHLY", "YEARLY"];

function countUnitLabel(plan: SubscriptionPlanName): string {
  return plan === "MONTHLY" ? "عدد الأشهر" : "عدد السنوات";
}

function formatEndDate(iso: string): string {
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

/**
 * تفعيل يدوي بلا دفع — يضبط نهاية اشتراك العيادة المحددة مباشرة من لوحة
 * الإدارة، بنفس قاعدة التمدد التراكمي عبر API الجلسة الإدارية حصراً.
 */
export function ManualActivationCard({ clinics }: { clinics: AdminClinicRow[] }) {
  const router = useRouter();
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");
  const [plan, setPlan] = useState<SubscriptionPlanName>("MONTHLY");
  const [count, setCount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneEndIso, setDoneEndIso] = useState<string | null>(null);

  async function onActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!clinicId || submitting) return;
    setSubmitting(true);
    setError(null);
    setDoneEndIso(null);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, count: Number(count) }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        subscriptionEndsAt?: string;
      } | null;
      if (!res.ok || !data?.subscriptionEndsAt) {
        setError(data?.error ?? "تعذر التفعيل — أعد المحاولة");
        return;
      }
      setDoneEndIso(data.subscriptionEndsAt);
      router.refresh();
    } catch {
      setError("لا يوجد اتصال — تحقق من الشبكة وأعد المحاولة");
    } finally {
      setSubmitting(false);
    }
  }

  if (clinics.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>تفعيل يدوي بلا دفع</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-steel-600">
          يضبط نهاية الاشتراك مباشرة بدون طلب دفع — التمديد تراكمي من نهاية
          الاشتراك القائم إن كان مستقبلاً.
        </p>

        <form onSubmit={onActivate} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <Field label="العيادة" htmlFor="activate-clinic">
              <Select
                id="activate-clinic"
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
              >
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="min-w-36">
            <Field label="الباقة" htmlFor="activate-plan">
              <Select
                id="activate-plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value as SubscriptionPlanName)}
              >
                {PLAN_OPTIONS.map((name) => (
                  <option key={name} value={name}>
                    باقة {SUBSCRIPTION_PLANS[name].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="w-32">
            <Field label={countUnitLabel(plan)} htmlFor="activate-count">
              <Input
                id="activate-count"
                type="number"
                min={1}
                max={60}
                step={1}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                required
              />
            </Field>
          </div>

          <Button type="submit" loading={submitting} disabled={!clinicId}>
            تفعيل بدون دفع
          </Button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger-600">
            {error}
          </p>
        )}
        {doneEndIso && !error && (
          <p role="status" className="mt-3 text-sm font-medium text-primary-700">
            تم التفعيل — الاشتراك الجديد ينتهي في {formatEndDate(doneEndIso)} وفتح
            الوصول فوراً.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
