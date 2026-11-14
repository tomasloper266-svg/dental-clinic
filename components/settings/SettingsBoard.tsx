"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DisplayCurrency } from "@/lib/currency";
import { ClinicInfoCard, type ClinicInfoPatch } from "./ClinicInfoCard";
import { AppLockCard } from "./AppLockCard";
import { BackupRestoreCard } from "./BackupRestoreCard";
import { CsvExportCard } from "./CsvExportCard";
import {
  ChannelsCard,
  EmailCard,
  PasswordCard,
  type SecurityOverview,
} from "./SecurityCards";

// لوحة الإعدادات المبنية على المخطط المرجعي: شبكة عمودين بالبطاقات الأربع
// (معلومات العيادة، قفل التطبيق، النسخ الاحتياطي والاستعادة، تصدير CSV)
// ثم قسم الحساب والأمان القائم. كل الحفظ عبر PATCH /api/settings المرتبط
// بجلسة العيادة حصراً.

type Overview = SecurityOverview & {
  name: string;
  clinicName: string;
  logoLetter: string;
  usdRate: number;
  currency: DisplayCurrency;
  openingBalance: number;
  workStart: string;
  workEnd: string;
  lockEnabled: boolean;
};

/** سطر تاريخ الترويسة — «السبت، 2026/11/14» بترتيب السنة أولاً كما في المخطط */
const WEEKDAY_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  weekday: "long",
});
const NUMERIC_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
export function weekdayDateHeading(date: Date): string {
  const [day, month, year] = NUMERIC_DATE_FMT.format(date).split("/");
  return `${WEEKDAY_FMT.format(date)}، ${year}/${month}/${day}`;
}

// ─── بطاقة حقل واحد — اسم الطبيب في قسم الحساب والأمان ─────────────────────

function SingleFieldCard({
  icon,
  title,
  description,
  fieldLabel,
  inputId,
  value,
  onSaved,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  fieldLabel: string;
  inputId: string;
  value: string;
  onSaved: (patch: Record<string, string>) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = draft.trim() !== value;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const failure = await onSaved({ name: draft.trim() });
    if (failure) setError(failure);
    setSaving(false);
  }

  return (
    <form onSubmit={onSubmit} aria-label={title}>
      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
            {icon}
            {title}
          </h2>
          <p className="text-sm text-warm-600">{description}</p>
          <Field label={fieldLabel} htmlFor={inputId}>
            <Input
              id={inputId}
              required
              minLength={2}
              maxLength={100}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>
          {error && (
            <p
              role="alert"
              className="rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving} disabled={!dirty}>
              حفظ
            </Button>
            {!dirty && !saving && (
              <span className="text-xs text-warm-500">لا تغييرات لحفظها</span>
            )}
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

export default function SettingsBoard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/settings");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setLoadError("تعذر تحميل بيانات الإعدادات — حدّث الصفحة");
        return;
      }
      setOverview((await res.json()) as Overview);
    } catch {
      setLoadError("تعذر الاتصال بالخادم — تحقق من الشبكة ثم أعد المحاولة");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // حفظ الإعدادات عبر PATCH الموحد — يعيد رسالة الخطأ أو null عند النجاح.
  const saveSettings = useCallback(
    async (
      patch: Record<string, string | number | boolean | undefined>,
    ): Promise<string | null> => {
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) return data.error ?? "تعذر الحفظ، حاول مرة أخرى";
        await load();
        return null;
      } catch {
        return "تعذر الاتصال بالخادم، حاول مرة أخرى";
      }
    },
    [load],
  );

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-panel border border-danger-100 bg-danger-50 p-8 text-center"
      >
        <p className="text-sm font-medium text-danger-700">{loadError}</p>
        <Button variant="secondary" className="mt-4" onClick={() => void load()}>
          <RefreshCw size={16} aria-hidden />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="animate-pulse space-y-4" aria-label="جارٍ التحميل">
        <div className="h-20 rounded-panel bg-warm-100" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-panel bg-warm-100" />
          <div className="h-64 rounded-panel bg-warm-100" />
          <div className="h-48 rounded-panel bg-warm-100" />
          <div className="h-48 rounded-panel bg-warm-100" />
        </div>
      </div>
    );
  }

  const clinicInitial: ClinicInfoPatch = {
    clinicName: overview.clinicName,
    logoLetter: overview.logoLetter,
    currency: overview.currency,
    usdRate: overview.usdRate,
    openingBalance: overview.openingBalance,
    workStart: overview.workStart,
    workEnd: overview.workEnd,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإعدادات"
        description={weekdayDateHeading(new Date())}
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ClinicInfoCard
          initial={clinicInitial}
          onSaved={(patch) => saveSettings({ ...patch })}
        />
        <AppLockCard
          initialEnabled={overview.lockEnabled}
          onSaved={(patch) => saveSettings({ lockEnabled: patch.enabled, pinCode: patch.pinCode })}
        />
        <BackupRestoreCard />
        <CsvExportCard />
      </div>

      <section aria-labelledby="security-heading" className="space-y-4">
        <h2 id="security-heading" className="text-lg font-semibold text-ink-900">
          الحساب والأمان
        </h2>
        <SingleFieldCard
          icon={<Stethoscope size={18} className="text-primary-700" aria-hidden />}
          title="بيانات الطبيب"
          description="اسمك يظهر في الترحيب وعلى خطط العلاج والوصفات."
          fieldLabel="اسم الطبيب"
          inputId="set-name"
          value={overview.name}
          onSaved={saveSettings}
        />
        <PasswordCard />
        <EmailCard overview={overview} onVerified={load} />
        <ChannelsCard channels={overview.channels} />
      </section>
    </div>
  );
}
