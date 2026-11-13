"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, RefreshCw, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ChannelsCard,
  EmailCard,
  PasswordCard,
  type SecurityOverview,
} from "./SecurityCards";

// لوحة الإعدادات: بيانات العيادة، بيانات الطبيب، الحساب والأمان (تغيير
// كلمة السر، البريد الموثق)، وشفافية حالة قنوات الإرسال — بياناتها من
// واجهة برمجة الحساب المرتبطة بالجلسة حصراً.

type Overview = SecurityOverview & {
  name: string;
  clinicName: string;
};

// ─── بطاقة بيانات موحّدة: حقل واحد للحفظ عبر PATCH الحساب ───────────────────

function SingleFieldCard({
  icon,
  title,
  description,
  fieldLabel,
  fieldHint,
  inputId,
  patchKey,
  value,
  onSaved,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  fieldLabel: string;
  fieldHint?: string;
  inputId: string;
  patchKey: "name" | "clinicName";
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
    const failure = await onSaved({ [patchKey]: draft.trim() });
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
          <Field label={fieldLabel} htmlFor={inputId} hint={fieldHint}>
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

// ─── اللوحة ─────────────────────────────────────────────────────────────────

export default function SettingsBoard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/account");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setLoadError("تعذر تحميل بيانات الحساب — حدّث الصفحة");
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

  // حفظ حقل واحد عبر PATCH — يعيد رسالة الخطأ أو null عند النجاح.
  async function saveProfile(patch: Record<string, string>): Promise<string | null> {
    try {
      const res = await fetch("/api/account", {
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
  }

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
        <div className="h-48 rounded-panel bg-warm-100" />
        <div className="h-48 rounded-panel bg-warm-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإعدادات"
        description="بيانات العيادة والطبيب، وحسابك وأمانه — كل شيء في مكان واحد."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SingleFieldCard
          icon={<Building2 size={18} className="text-primary-700" aria-hidden />}
          title="بيانات العيادة"
          description="اسم العيادة يظهر للمرضى وعلى التقارير والوصولات."
          fieldLabel="اسم العيادة"
          inputId="set-clinic"
          patchKey="clinicName"
          value={overview.clinicName}
          onSaved={saveProfile}
        />
        <SingleFieldCard
          icon={<Stethoscope size={18} className="text-primary-700" aria-hidden />}
          title="بيانات الطبيب"
          description="اسمك يظهر في الترحيب وعلى خطط العلاج والوصفات."
          fieldLabel="اسم الطبيب"
          inputId="set-name"
          patchKey="name"
          value={overview.name}
          onSaved={saveProfile}
        />
      </div>

      <section aria-labelledby="security-heading" className="space-y-4">
        <h2 id="security-heading" className="text-lg font-semibold text-ink-900">
          الحساب والأمان
        </h2>
        <PasswordCard />
        <EmailCard overview={overview} onVerified={load} />
        <ChannelsCard channels={overview.channels} />
      </section>
    </div>
  );
}
