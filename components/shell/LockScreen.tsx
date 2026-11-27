"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { firstLetter } from "@/components/ui/EntityCell";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";

type LockScreenProps = {
  userName: string;
  /** اسم العيادة — يظهر تحت اسم المستخدم على شاشة القفل */
  clinicName?: string;
};

/**
 * شاشة القفل كاملة الشاشة — قفل الهاتف: عند تفعيل قفل الحساب يُطلب الرمز
 * الرقمي قبل الدخول. الرمز خاطئ يظهر خطأ ويُفرَّغ الحقل، والنجاح يعيد
 * تحميل الصفحات المفتوحة بعد إصدار كوكي الفتح.
 */
export function LockScreen({ userName, clinicName }: LockScreenProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (pin.length !== 4 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? t("lock.error.unlock"));
      setPin("");
    } catch {
      setError(t("lock.error.network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-surface-sunken flex min-h-screen items-center justify-center px-4">
      <div className="rounded-card border-warm-200 bg-surface w-full max-w-sm border p-8 text-center shadow-sm">
        <div
          className={cn(
            "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full",
            "bg-primary-50 text-primary-700 text-lg font-bold",
          )}
          aria-hidden
        >
          {firstLetter(userName)}
        </div>
        <h1 className="text-ink-900 text-lg font-bold">{userName}</h1>
        {clinicName && (
          <p className="text-warm-500 mt-1 text-sm">{clinicName}</p>
        )}

        <div className="text-warm-600 mt-6 flex items-center justify-center gap-2">
          <LockKeyhole size={18} aria-hidden />
          <span className="text-sm font-semibold">{t("lock.title")}</span>
        </div>
        <p className="text-warm-500 mt-2 text-xs">{t("lock.subtitle")}</p>

        <form onSubmit={onUnlock} className="mt-5 flex flex-col gap-3">
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
              setError(null);
            }}
            aria-label={t("lock.pin")}
            aria-invalid={error !== null || undefined}
            className="text-center text-lg tracking-[0.5em]"
          />
          {error && (
            <p role="alert" className="text-danger-600 text-xs font-semibold">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="gold"
            loading={submitting}
            disabled={pin.length !== 4}
          >
            {t("lock.unlock")}
          </Button>
        </form>
      </div>
    </div>
  );
}
