"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { Gender, PatientDto } from "@/lib/services/patients";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

// نموذج إنشاء/تعديل بيانات المريض — نفس النموذج للحالتين: يُرسل POST عند
// الإنشاء وPATCH عند التعديل. الحقول وترتيبها من المرجع: الاسم الكامل،
// الهاتفان، الجنس، سنة الميلاد، العنوان، البريد، الرقم الوطني، فصيلة الدم،
// الحساسيات، الأمراض المزمنة، هاتف المنزل، جهات اتصال الطوارئ، الملاحظات.

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

type Props = {
  // null = إنشاء مريض جديد
  editing: PatientDto | null;
  onSaved: () => void;
  onCancel: () => void;
};

type FormState = {
  name: string;
  phone: string;
  secondaryPhone: string;
  homePhone: string;
  gender: "" | Gender;
  birthYear: string;
  address: string;
  email: string;
  nationalId: string;
  bloodType: string;
  allergies: string;
  chronicDiseases: string;
  emergencyContacts: string;
  medicalNotes: string;
};

function initialState(patient: PatientDto | null): FormState {
  return {
    name: patient?.name ?? "",
    phone: patient?.phone ?? "",
    secondaryPhone: patient?.secondaryPhone ?? "",
    homePhone: patient?.homePhone ?? "",
    gender: patient?.gender ?? "",
    birthYear: patient?.birthYear ? String(patient.birthYear) : "",
    address: patient?.address ?? "",
    email: patient?.email ?? "",
    nationalId: patient?.nationalId ?? "",
    bloodType: patient?.bloodType ?? "",
    allergies: patient?.allergies ?? "",
    chronicDiseases: patient?.chronicDiseases ?? "",
    emergencyContacts: patient?.emergencyContacts ?? "",
    medicalNotes: patient?.medicalNotes ?? "",
  };
}

export default function PatientForm({ editing, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(editing));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const birthYear = form.birthYear.trim() ? Number(form.birthYear) : null;
    // الحقول الفارغة تُرسل فارغة صراحة — «أُفرغ الحقل» لا «أُهمل»
    const body = {
      name: form.name,
      birthYear,
      gender: form.gender || null,
      phone: form.phone.trim(),
      secondaryPhone: form.secondaryPhone.trim(),
      homePhone: form.homePhone.trim(),
      address: form.address.trim(),
      email: form.email.trim(),
      nationalId: form.nationalId.trim(),
      bloodType: form.bloodType.trim(),
      allergies: form.allergies.trim(),
      chronicDiseases: form.chronicDiseases.trim(),
      emergencyContacts: form.emergencyContacts.trim(),
      medicalNotes: form.medicalNotes.trim(),
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
          <Field label="الاسم الكامل *" htmlFor="name">
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

        <Field label="الهاتف الأساسي" htmlFor="phone">
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

        <Field label="هاتف إضافي" htmlFor="secondaryPhone">
          <Input
            id="secondaryPhone"
            type="tel"
            dir="ltr"
            className="text-start"
            value={form.secondaryPhone}
            onChange={(e) => set("secondaryPhone", e.target.value)}
          />
        </Field>

        <Field label="الجنس" htmlFor="gender">
          <Select
            id="gender"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value as FormState["gender"])}
          >
            <option value="">—</option>
            <option value="MALE">ذكر</option>
            <option value="FEMALE">أنثى</option>
          </Select>
        </Field>

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

        <Field label="العنوان" htmlFor="address">
          <Input
            id="address"
            type="text"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="المدينة - الحي"
          />
        </Field>

        <Field label="البريد الإلكتروني" htmlFor="email">
          <Input
            id="email"
            type="email"
            dir="ltr"
            className="text-start"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <Field label="الرقم الوطني / الهوية" htmlFor="nationalId">
          <Input
            id="nationalId"
            type="text"
            dir="ltr"
            className="text-start"
            value={form.nationalId}
            onChange={(e) => set("nationalId", e.target.value)}
          />
        </Field>

        <Field label="فصيلة الدم" htmlFor="bloodType">
          <Select
            id="bloodType"
            value={form.bloodType}
            onChange={(e) => set("bloodType", e.target.value)}
          >
            <option value="">—</option>
            {BLOOD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field
            label={
              <span className="inline-flex items-center gap-1.5">
                <TriangleAlert
                  size={14}
                  aria-hidden
                  className="text-warning-500"
                />
                الحساسيات
              </span>
            }
            htmlFor="allergies"
          >
            <Input
              id="allergies"
              type="text"
              className="border-danger-300"
              value={form.allergies}
              onChange={(e) => set("allergies", e.target.value)}
              placeholder="حساسية البنسلين…"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="الأمراض المزمنة" htmlFor="chronicDiseases">
            <Input
              id="chronicDiseases"
              type="text"
              value={form.chronicDiseases}
              onChange={(e) => set("chronicDiseases", e.target.value)}
              placeholder="ضغط دم مرتفع، سكري…"
            />
          </Field>
        </div>

        <Field label="هاتف المنزل" htmlFor="homePhone">
          <Input
            id="homePhone"
            type="tel"
            dir="ltr"
            className="text-start"
            value={form.homePhone}
            onChange={(e) => set("homePhone", e.target.value)}
          />
        </Field>

        <Field label="جهات اتصال الطوارئ" htmlFor="emergencyContacts">
          <Input
            id="emergencyContacts"
            type="text"
            value={form.emergencyContacts}
            onChange={(e) => set("emergencyContacts", e.target.value)}
            placeholder="الاسم — رقم الهاتف"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="الملاحظات" htmlFor="medicalNotes">
            <Textarea
              id="medicalNotes"
              rows={3}
              value={form.medicalNotes}
              onChange={(e) => set("medicalNotes", e.target.value)}
            />
          </Field>
        </div>
      </div>

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
          {submitting ? "جارٍ الحفظ…" : "حفظ البيانات"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
