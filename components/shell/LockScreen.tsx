"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { firstLetter } from "@/components/ui/EntityCell";
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
      setError(payload?.error ?? "تعذر فتح القفل — أعد المحاولة");
      setPin("");
    } catch {
      setError("لا يوجد اتصال — تحقق من الشبكة وأعد المحاولة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm rounded-card border border-warm-200 bg-surface p-8 text-center shadow-sm">
        <div
          className={cn(
            "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full",
            "bg-primary-50 text-lg font-bold text-primary-700",
          )}
          aria-hidden
        >
          {firstLetter(userName)}
        </div>
        <h1 className="text-lg font-bold text-ink-900">{userName}</h1>
        {clinicName && <p className="mt-1 text-sm text-warm-500">{clinicName}</p>}

        <div className="mt-6 flex items-center justify-center gap-2 text-warm-600">
          <LockKeyhole size={18} aria-hidden />
          <span className="text-sm font-semibold">التطبيق مقفل</span>
        </div>
        <p className="mt-2 text-xs text-warm-500">
          أدخل الرمز الرقمي (4 أرقام) لفتح القفل
        </p>

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
            aria-label="الرمز الرقمي"
            aria-invalid={error !== null || undefined}
            className="text-center text-lg tracking-[0.5em]"
          />
          {error && (
            <p role="alert" className="text-xs font-semibold text-danger-600">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="gold"
            loading={submitting}
            disabled={pin.length !== 4}
          >
            فتح القفل
          </Button>
        </form>
      </div>
    </div>
  );
}
