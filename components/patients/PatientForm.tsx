"use client";

import { useState } from "react";
import {
  composeMedicalNotes,
  parseMedicalNotes,
} from "@/lib/medical-notes";
import type { PatientDto } from "@/lib/services/patients";

// نموذج إنشاء/تحرير مريض — نفس النموذج للحالتين: يُرسل POST عند الإنشاء
// وPATCH عند التحرير، والأخطاء تعرض حسب الرد من الخادم.

type Props = {
  // null = إنشاء مريض جديد
  editing: PatientDto | null;
  onSaved: (patient: PatientDto) => void;
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

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-600 focus:outline-none";

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
      onSaved(data.patient);
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl bg-white p-4 shadow-md sm:p-6"
    >
      <h2 className="text-lg font-bold text-teal-800">
        {editing ? "تحرير مريض" : "مريض جديد"}
      </h2>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          الاسم *
        </label>
        <input
          id="name"
          type="text"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="birthYear" className="mb-1 block text-sm font-medium">
            سنة الميلاد
          </label>
          <input
            id="birthYear"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            value={form.birthYear}
            onChange={(e) => set("birthYear", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">
            الهاتف
          </label>
          <input
            id="phone"
            type="tel"
            dir="ltr"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={`${inputClass} text-left`}
            placeholder="09xxxxxxxx"
          />
        </div>
      </div>

      <div>
        <label htmlFor="address" className="mb-1 block text-sm font-medium">
          العنوان
        </label>
        <input
          id="address"
          type="text"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          className={inputClass}
        />
      </div>

      <fieldset className="rounded-lg border border-gray-200 p-3">
        <legend className="px-1 text-sm font-semibold text-gray-700">
          الملاحظات الطبية
        </legend>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="allergies"
              className="mb-1 block text-sm font-medium text-red-700"
            >
              حساسية
            </label>
            <textarea
              id="allergies"
              rows={2}
              value={form.allergies}
              onChange={(e) => set("allergies", e.target.value)}
              className={inputClass}
              placeholder="بنسلين، لاتكس..."
            />
          </div>
          <div>
            <label
              htmlFor="conditions"
              className="mb-1 block text-sm font-medium"
            >
              أمراض مزمنة
            </label>
            <textarea
              id="conditions"
              rows={2}
              value={form.conditions}
              onChange={(e) => set("conditions", e.target.value)}
              className={inputClass}
              placeholder="سكري، ضغط..."
            />
          </div>
          <div>
            <label
              htmlFor="medications"
              className="mb-1 block text-sm font-medium"
            >
              أدوية حالية
            </label>
            <textarea
              id="medications"
              rows={2}
              value={form.medications}
              onChange={(e) => set("medications", e.target.value)}
              className={inputClass}
              placeholder="وارفارين، إنسولين..."
            />
          </div>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "جارٍ الحفظ..." : "حفظ"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 disabled:opacity-50"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
