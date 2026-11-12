"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Pencil, Plus, Search, TriangleAlert, Users } from "lucide-react";
import { parseMedicalNotes } from "@/lib/medical-notes";
import { pageWrapClass } from "@/lib/page-width";
import type { PatientDto } from "@/lib/services/patients";
import {
  PATIENT_FILTERS,
  ageFromBirthYear,
  countFlags,
  filterPatients,
  patientNotesFlags,
  type PatientFilterKey,
} from "@/lib/patients-view";
import PatientForm from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/components/ui/cn";

// شاشة المرضى: بحث فوري بالاسم والهاتف مع تخفيف الإدخال (300ms)، فلاتر
// الملاحظات الطبية تصفية زبونية فوق النتائج، جدول كامل بملف لكل مريض،
// والحالات الأربع: تحميل/فراغ/خطأ/نتائج.

const SEARCH_DEBOUNCE_MS = 300;

const flagBadge: Record<keyof ReturnType<typeof patientNotesFlags>, string> = {
  allergies: "border-danger-300 bg-danger-50 text-danger-700",
  conditions: "border-warning-300 bg-warning-50 text-warning-900",
  medications: "border-ink-600/20 bg-surface-sunken text-ink-800",
};

const flagLabel = {
  allergies: "حساسية",
  conditions: "أمراض",
  medications: "أدوية",
} as const;

function NotesBadges({ raw }: { raw: string | null | undefined }) {
  const flags = patientNotesFlags(raw);
  const notes = parseMedicalNotes(raw);
  const items = (Object.keys(flags) as Array<keyof typeof flags>)
    .filter((key) => flags[key])
    .map((key) => {
      const value =
        key === "allergies"
          ? notes.allergies
          : key === "conditions"
            ? notes.conditions
            : notes.medications;
      const first = value.split("\n")[0].trim();
      return (
        <Badge key={key} className={flagBadge[key]}>
          <TriangleAlert size={11} aria-hidden className={key === "medications" ? "hidden" : ""} />
          {flagLabel[key]}: {first}
        </Badge>
      );
    });
  if (items.length === 0) return <span className="text-warm-400 text-xs">—</span>;
  return <div className="flex flex-wrap gap-1">{items}</div>;
}

function AgeCell({ birthYear }: { birthYear: number | null }) {
  const age = ageFromBirthYear(birthYear);
  if (age === null) return <span className="text-warm-400 text-xs">—</span>;
  return (
    <span className="numeric">
      {age} <span className="text-warm-400 text-xs">سنة</span>
    </span>
  );
}

function RowsSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <TRow key={i}>
          {[0, 1, 2, 3, 4].map((j) => (
            <TD key={j}>
              <div className="h-5 animate-pulse rounded bg-warm-100" aria-hidden />
            </TD>
          ))}
        </TRow>
      ))}
    </>
  );
}

export default function PatientsView() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PatientFilterKey>("ALL");
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

  const visible = useMemo(
    () => (patients ? filterPatients(patients, filter) : null),
    [patients, filter],
  );
  const counts = useMemo(
    () => (patients ? countFlags(patients) : null),
    [patients],
  );

  const filtered = filter !== "ALL";
  const searching = query.trim().length > 0;

  return (
    <div className={pageWrapClass("full")}>
      <PageHeader
        title="المرضى"
        description="سجل مرضى العيادة — البحث والفلاتر من النتائج المرجعة، وملف طبي كامل لكل مريض."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} aria-hidden />
            مريض جديد
          </Button>
        }
      />

      {showForm && (
        <Modal
          open={showForm}
          onClose={closeForm}
          title={editing ? "تحرير مريض" : "مريض جديد"}
        >
          <PatientForm editing={editing} onSaved={onSaved} onCancel={closeForm} />
        </Modal>
      )}

      {error ? (
        <div
          role="alert"
          className="mt-5 flex flex-col items-center gap-3 rounded-panel border border-danger-300 bg-danger-50 px-6 py-10 text-center"
        >
          <p className="text-sm font-medium text-danger-700">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load(query.trim())}>
            إعادة المحاولة
          </Button>
        </div>
      ) : (
        <>
          {/* شريط البحث والفلاتر */}
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search
                size={16}
                aria-hidden
                className="absolute start-3 top-1/2 -translate-y-1/2 text-warm-400"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث بالاسم أو الهاتف…"
                aria-label="بحث بالاسم أو الهاتف"
                className="ps-9"
              />
            </div>

            <div
              role="group"
              aria-label="تصفية حسب الملاحظات الطبية"
              className="flex flex-wrap gap-1"
            >
              {PATIENT_FILTERS.map(({ key, label }) => {
                const active = filter === key;
                const count =
                  counts && key !== "ALL" ? counts[key] : (patients?.length ?? 0);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(key)}
                    className={cn(
                      "rounded-field border px-3 py-1.5 text-xs font-medium transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                      active
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-warm-300 bg-surface-raised text-warm-600 hover:bg-surface-hover active:bg-surface-sunken",
                    )}
                  >
                    {label}
                    <span
                      className={cn(
                        "numeric ms-1.5 text-[10px]",
                        active ? "text-primary-100" : "text-warm-400",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {visible === null ? (
            <Table className="mt-4" aria-busy="true">
              <THead>
                <TRow>
                  <TH className="w-[22%]">الاسم</TH>
                  <TH className="w-[15%]">الهاتف</TH>
                  <TH className="hidden w-[10%] md:table-cell">العمر</TH>
                  <TH className="hidden w-[15%] lg:table-cell">العنوان</TH>
                  <TH>الملاحظات الطبية</TH>
                  <TH className="w-[10%]">
                    <span className="sr-only">إجراءات</span>
                  </TH>
                </TRow>
              </THead>
              <tbody>
                <RowsSkeleton />
              </tbody>
            </Table>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Users}
              className="mt-4"
              title={
                filtered || searching
                  ? "لا نتائج مطابقة"
                  : "لا مرضى مسجلين بعد"
              }
              description={
                filtered
                  ? "لا يوجد مريض ضمن هذا الفلتر — جرّب فلتراً آخر أو ابحث باسم آخر."
                  : searching
                    ? "جرّب اسماً أو رقماً أقصر."
                    : "أضف أول مريض بزر «مريض جديد»."
              }
              action={
                filtered ? (
                  <Button variant="secondary" size="sm" onClick={() => setFilter("ALL")}>
                    إلغاء الفلتر
                  </Button>
                ) : !searching ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus size={14} aria-hidden />
                    مريض جديد
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table className="mt-4">
              <THead>
                <TRow>
                  <TH>الاسم</TH>
                  <TH>الهاتف</TH>
                  <TH className="hidden md:table-cell">العمر</TH>
                  <TH className="hidden lg:table-cell">العنوان</TH>
                  <TH>الملاحظات الطبية</TH>
                  <TH>
                    <span className="sr-only">إجراءات</span>
                  </TH>
                </TRow>
              </THead>
              <tbody>
                {visible.map((patient) => (
                  <TRow key={patient.id} className="group">
                    <TD>
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-medium text-ink-900 transition-colors group-hover:text-primary-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                      >
                        {patient.name}
                      </Link>
                    </TD>
                    <TD>
                      {patient.phone ? (
                        <span dir="ltr" className="numeric block text-start text-warm-700">
                          {patient.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-warm-400">—</span>
                      )}
                    </TD>
                    <TD className="hidden md:table-cell">
                      <AgeCell birthYear={patient.birthYear} />
                    </TD>
                    <TD className="hidden max-w-40 truncate lg:table-cell">
                      {patient.address ?? <span className="text-xs text-warm-400">—</span>}
                    </TD>
                    <TD>
                      <NotesBadges raw={patient.medicalNotes} />
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/patients/${patient.id}`}
                          aria-label={`فتح ملف ${patient.name}`}
                          title="فتح الملف"
                          className="rounded-field p-1.5 text-warm-500 transition-colors hover:bg-surface-hover hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                        >
                          <FileText size={16} aria-hidden />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(patient)}
                          aria-label={`تحرير بيانات ${patient.name}`}
                          title="تحرير"
                          className="rounded-field p-1.5 text-warm-500 transition-colors hover:bg-surface-hover hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                      </div>
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          )}

          {visible && visible.length > 0 && (
            <p className="text-warm-500 mt-3 text-xs">
              <span className="numeric">{visible.length}</span> مريض
              {searching ? " ضمن نتائج البحث" : ""}
              {filtered ? " ضمن الفلتر" : ""} — الحد الأقصى للعرض 100 مريض.
            </p>
          )}
        </>
      )}
    </div>
  );
}
