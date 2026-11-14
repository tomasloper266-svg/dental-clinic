"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

// بطاقة «قفل التطبيق» — تفعيل/تعطيل قفل حساب الجلسة الحالي مع إمكانية
// إعادة تعيين الرمز الرقمي. الرمز لا يُعرض أبداً — الحقل يعيد تعيينه فقط،
// ويُهشَّر في الخدمة قبل التخزين. تفعيل بلا رمز جديد يبقي الرمز الحالي
// (أو يضع الافتراضي 0000 إن لم يوجد رمز بعد).

export type AppLockPatch = {
  enabled: boolean;
  /** الرمز الجديد — يُرسل فقط إذا غيّره المستخدم */
  pinCode?: string;
};

type AppLockCardProps = {
  initialEnabled: boolean;
  onSaved: (patch: AppLockPatch) => Promise<string | null>;
};

const LOCK_STATE_OPTIONS = [
  { value: "ENABLED", label: "تفعيل" },
  { value: "DISABLED", label: "معطل" },
];

export function AppLockCard({ initialEnabled, onSaved }: AppLockCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pinDraft, setPinDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const pinDirty = pinDraft.trim() !== "";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const pin = pinDraft.trim();
    if (pin !== "" && !/^\d{4}$/.test(pin)) {
      setError("الرمز الرقمي 4 أرقام بالضبط");
      return;
    }
    setError(null);
    setSaving(true);
    const failure = await onSaved({
      enabled,
      ...(pin !== "" ? { pinCode: pin } : {}),
    });
    if (failure) {
      setError(failure);
    } else {
      setSaved(true);
      setPinDraft("");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={onSubmit} aria-label="قفل التطبيق">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <LockKeyhole size={18} className="text-primary-700" aria-hidden />
            قفل التطبيق
          </h2>
          <p className="text-sm text-warm-600">
            عند التفعيل يُطلب الرمز الرقمي لفتح التطبيق، كقفل الهاتف — لكل حساب
            رمزه الخاص وحالته المستقلة.
          </p>

          <Field label="حالة القفل" htmlFor="set-lock-enabled">
            <Select
              id="set-lock-enabled"
              value={enabled ? "ENABLED" : "DISABLED"}
              onChange={(e) => setEnabled(e.target.value === "ENABLED")}
            >
              {LOCK_STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="رمز الدخول (الرقمي)"
            htmlFor="set-lock-pin"
            hint={pinDirty ? undefined : "اتركه فارغاً للاحتفاظ بالرمز الحالي"}
          >
            <Input
              id="set-lock-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              placeholder="0000"
              maxLength={4}
              value={pinDraft}
              onChange={(e) => {
                setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError(null);
                setSaved(false);
              }}
            />
          </Field>

          <p className="rounded-field bg-surface-sunken px-3 py-2.5 text-xs leading-6 text-warm-600">
            الرمز الرقمي: 0000 — 4 أرقام. يمكنك تغييره في أي وقت. عند التفعيل
            سيُطلب الرمز عند الدخول.
          </p>

          {error && (
            <p
              role="alert"
              className="rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}
          {saved && !error && (
            <p
              role="status"
              className="rounded-field border border-success-100 bg-success-50 px-3 py-2.5 text-sm text-success-700"
            >
              تم حفظ إعدادات القفل
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="gold"
              loading={saving}
              disabled={enabled === initialEnabled && !pinDirty}
            >
              حفظ
            </Button>
            {enabled === initialEnabled && !pinDirty && !saving && (
              <span className="text-xs text-warm-500">لا تغييرات لحفظها</span>
            )}
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
