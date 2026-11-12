"use client";

import { useState } from "react";
import {
  composeMedicalNotes,
  parseMedicalNotes,
} from "@/lib/medical-notes";
import type { PatientDto } from "@/lib/services/patients";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

// نموذج إنشاء/تحرير مريض — نفس النموذج للحالتين: يُرسل POST عند الإنشاء
// وPATCH عند التحرير، والأخطاء تعرض حسب الرد من الخادم.
// يُعرض داخل Modal في صفحة المرضى وملف المريض — بلا سطح خاص به.

type Props = {
  // null = إنشاء مريض جديد
  editing: PatientDto | null;
  onSaved: () => void;
  onCancel: () => void;
};

type FormState = {
  name: string;
  birthYear: string;
  phone: string;
  address: string;
  allergies: string;
  conditions: string;
  medications: string;
  // أسطر حرمة موجودة سابقاً خارج الأقسام — تُحفظ ولا تُعرض للتحرير.
  other: string;
};

function initialState(patient: PatientDto | null): FormState {
  const notes = parseMedicalNotes(patient?.medicalNotes);
  return {
    name: patient?.name ?? "",
    birthYear: patient?.birthYear ? String(patient.birthYear) : "",
    phone: patient?.phone ?? "",
    address: patient?.address ?? "",
    allergies: notes.allergies,
    conditions: notes.conditions,
    medications: notes.medications,
    other: notes.other,
  };
}

export default function PatientForm({ editing, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(editing));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const birthYear = form.birthYear.trim() ? Number(form.birthYear) : undefined;
    const body = {
      name: form.name,
      birthYear,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      medicalNotes:
        composeMedicalNotes({
          allergies: form.allergies,
          conditions: form.conditions,
          medications: form.medications,
          other: form.other,
        }) || undefined,
    };

    try {
      const res = await fetch(
        editing ? `/api/patients/${editing.id}` : "/api/patients",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as {
        patient?: PatientDto;
        error?: string;
      };
      if (!res.ok || !data.patient) {
        setError(data.error ?? "حدث خطأ غير متوقع");
        return;
      }
      onSaved();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="الاسم" htmlFor="name">
            <Input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              aria-required="true"
            />
          </Field>
        </div>

        <Field label="سنة الميلاد" htmlFor="birthYear" hint="لحساب العمر في القائمة والملف">
          <Input
            id="birthYear"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            value={form.birthYear}
            onChange={(e) => set("birthYear", e.target.value)}
          />
        </Field>

        <Field label="الهاتف" htmlFor="phone">
          <Input
            id="phone"
            type="tel"
            dir="ltr"
            className="text-start"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="09xxxxxxxx"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="العنوان" htmlFor="address">
            <Input
              id="address"
              type="text"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* الملاحظات الطبية — الحساسية أولى بالتلميح البصري لأنها الأخطر سريرياً */}
      <fieldset className="rounded-field border border-warm-200 bg-surface px-3 py-3">
        <legend className="text-warm-700 px-1 text-xs font-semibold">
          الملاحظات الطبية
        </legend>
        <div className="space-y-3">
          <Field label="حساسية" htmlFor="allergies">
            <Textarea
              id="allergies"
              rows={2}
              className="border-danger-300"
              value={form.allergies}
              onChange={(e) => set("allergies", e.target.value)}
              placeholder="بنسلين، لاتكس…"
            />
          </Field>
          <Field label="أمراض مزمنة" htmlFor="conditions">
            <Textarea
              id="conditions"
              rows={2}
              value={form.conditions}
              onChange={(e) => set("conditions", e.target.value)}
              placeholder="سكري، ضغط…"
            />
          </Field>
          <Field label="أدوية حالية" htmlFor="medications">
            <Textarea
              id="medications"
              rows={2}
              value={form.medications}
              onChange={(e) => set("medications", e.target.value)}
              placeholder="وارفارين، إنسولين…"
            />
          </Field>
        </div>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-field border border-danger-300 bg-danger-50 text-danger-700 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <div className="flex justify-start gap-2 pt-1">
        <Button type="submit" loading={submitting}>
          {submitting ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
