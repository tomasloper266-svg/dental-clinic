"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/core";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import type { DisplayCurrency } from "@/lib/currency";

// بطاقة «معلومات العيادة» — اسم العيادة (يغذي الشريط الجانبي)، رمز
// العيادة/المدير، العملة المعروضة وسعر صرف الدولار، الرصيد الافتتاحي،
// وساعات العمل. الحفظ عبر PATCH /api/settings بجسم واحد.

export type ClinicInfoPatch = {
  clinicName: string;
  logoLetter: string;
  currency: DisplayCurrency;
  usdRate: number;
  openingBalance: number;
  workStart: string;
  workEnd: string;
};

type ClinicInfoCardProps = {
  initial: ClinicInfoPatch;
  onSaved: (patch: ClinicInfoPatch) => Promise<string | null>;
};

/** خيارات ساعات العمل بخطوة نصف ساعة — «12:00 AM» حتى «11:30 PM» (يوم كامل) */
const WORK_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const halfHour = Math.floor(index / 2);
  const hour12 = halfHour % 12 === 0 ? 12 : halfHour % 12;
  const suffix = halfHour < 12 ? "AM" : "PM";
  return `${String(hour12).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"} ${suffix}`;
});

const CURRENCY_OPTIONS: { value: DisplayCurrency; labelKey: TranslationKey }[] = [
  { value: "USD", labelKey: "settings.usd" },
  { value: "SYP", labelKey: "settings.syp" },
];

export function ClinicInfoCard({ initial, onSaved }: ClinicInfoCardProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    draft.clinicName !== initial.clinicName ||
    draft.logoLetter !== initial.logoLetter ||
    draft.currency !== initial.currency ||
    String(draft.usdRate) !== String(initial.usdRate) ||
    String(draft.openingBalance) !== String(initial.openingBalance) ||
    draft.workStart !== initial.workStart ||
    draft.workEnd !== initial.workEnd;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const failure = await onSaved(draft);
    if (failure) setError(failure);
    setSaving(false);
  }

  return (
    <form onSubmit={onSubmit} aria-label={t("settings.clinicInfo")}>
      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            <Building2 size={18} className="text-primary-700" aria-hidden />
            {t("settings.clinicInfo")}
          </h2>

          <Field label={t("settings.clinicName")} htmlFor="set-clinic-name">
            <Input
              id="set-clinic-name"
              required
              minLength={2}
              maxLength={100}
              value={draft.clinicName}
              onChange={(e) => setDraft({ ...draft, clinicName: e.target.value })}
            />
          </Field>

          <Field
            label={t("subscription.clinicCode")}
            htmlFor="set-logo-letter"
            hint={t("settings.logoLetterHint")}
          >
            <Input
              id="set-logo-letter"
              maxLength={2}
              value={draft.logoLetter}
              onChange={(e) => setDraft({ ...draft, logoLetter: e.target.value })}
            />
          </Field>

          <Field
            label={t("settings.currencyCode")}
            htmlFor="set-currency"
            hint={t("settings.currencyHint")}
          >
            <Select
              id="set-currency"
              value={draft.currency}
              onChange={(e) =>
                setDraft({ ...draft, currency: e.target.value as DisplayCurrency })
              }
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t("settings.usdRate")}
            htmlFor="set-usd-rate"
            hint={t("settings.usdRateHint")}
          >
            <Input
              id="set-usd-rate"
              required
              type="number"
              inputMode="decimal"
              min="1"
              step="any"
              value={draft.usdRate}
              onChange={(e) =>
                setDraft({ ...draft, usdRate: Number(e.target.value) })
              }
            />
          </Field>

          <Field label={t("settings.openingBalance")} htmlFor="set-opening-balance">
            <Input
              id="set-opening-balance"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={draft.openingBalance}
              onChange={(e) =>
                setDraft({ ...draft, openingBalance: Number(e.target.value) })
              }
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("appointments.fromHour")} htmlFor="set-work-start">
              <Select
                id="set-work-start"
                value={draft.workStart}
                onChange={(e) => setDraft({ ...draft, workStart: e.target.value })}
              >
                {WORK_TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("appointments.toHour")} htmlFor="set-work-end">
              <Select
                id="set-work-end"
                value={draft.workEnd}
                onChange={(e) => setDraft({ ...draft, workEnd: e.target.value })}
              >
                {WORK_TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="gold" loading={saving} disabled={!dirty}>
              {t("common.saveEdits")}
            </Button>
            {!dirty && !saving && (
              <span className="text-xs text-warm-500">{t("common.noChanges")}</span>
            )}
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
