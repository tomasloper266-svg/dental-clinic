"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseMedicalNotes } from "@/lib/medical-notes";
import type { PatientDto } from "@/lib/services/patients";
import PatientForm from "@/components/patients/PatientForm";

// شاشة المرضى: بحث فوري بالاسم والهاتف مع تخفيف الإدخال (300ms)،
// إنشاء وتحرير بنفس النموذج، والحالات الأربع: تحميل/فراغ/خطأ/نتائج.

const SEARCH_DEBOUNCE_MS = 300;

function PatientCard({
  patient,
  onEdit,
}: {
  patient: PatientDto;
  onEdit: () => void;
}) {
  const notes = parseMedicalNotes(patient.medicalNotes);
  const birthYear = patient.birthYear ? `${patient.birthYear} م` : null;
  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">
            {patient.name}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {[patient.phone, birthYear, patient.address]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {notes.allergies && (
            <p className="mt-2 inline-block rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
              حساسية: {notes.allergies}
            </p>
          )}
          {(notes.conditions || notes.medications) && (
            <p className="mt-1 text-xs text-neutral-500">
              {[
                notes.conditions && `أمراض: ${notes.conditions}`,
                notes.medications && `أدوية: ${notes.medications}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-lg border border-teal-700 px-3 py-1.5 text-sm font-medium text-teal-700"
        >
          تحرير
        </button>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-3" aria-label="جارٍ التحميل">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-20 animate-pulse rounded-xl bg-neutral-100"
          aria-hidden
        />
      ))}
    </ul>
  );
}

export default function PatientsView() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PatientDto | null>(null);

  const load = useCallback(
    async (search: string) => {
      setError(null);
      try {
        const res = await fetch(
          `/api/patients${search ? `?q=${encodeURIComponent(search)}` : ""}`,
        );
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError("تعذر تحميل قائمة المرضى، حاول مرة أخرى");
          return;
        }
        const data = (await res.json()) as { patients: PatientDto[] };
        setPatients(data.patients);
      } catch {
        setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
      }
    },
    [router],
  );

  useEffect(() => {
    const timer = setTimeout(
      () => void load(query.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query, load]);

  function onSaved() {
    setShowForm(false);
    setEditing(null);
    void load(query.trim());
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(patient: PatientDto) {
    setEditing(patient);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-teal-800">المرضى</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
        >
          مريض جديد
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="بحث بالاسم أو الهاتف..."
        aria-label="بحث بالاسم أو الهاتف"
        className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-600 focus:outline-none"
      />

      {showForm && (
        <div className="mb-6">
          <PatientForm
            editing={editing}
            onSaved={onSaved}
            onCancel={closeForm}
          />
        </div>
      )}

      {error ? (
        <div className="rounded-xl bg-red-50 p-4 text-center text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load(query.trim())}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-medium"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : patients === null ? (
        <ListSkeleton />
      ) : patients.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-neutral-700">
            {query ? "لا نتائج مطابقة للبحث" : "لا مرضى مسجلين بعد"}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {query
              ? "جرّب اسماً أو رقماً أقصر"
              : "أضف أول مريض بزر «مريض جديد» أعلى الشاشة"}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {patients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onEdit={() => openEdit(patient)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
