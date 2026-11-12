"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PatientDto } from "@/lib/services/patients";
import {
  pickLastKnownPatient,
  saveLastPatientId,
} from "@/lib/patients/last-patient";
import { cn } from "@/components/ui/cn";

const SEARCH_DEBOUNCE_MS = 300;

type PatientPickerProps = {
  /** أساس المسار الذي يعمل عليه المنتقي — /chart أو /plans */
  basePath: string;
  /** المريض المختار حالياً في الصفحة (من ?patient=) */
  selectedPatientId?: string;
  className?: string;
};

/**
 * منتقي المريض — مصدر واحد للواجهة تشاركه صفحتا /chart و/plans.
 * عند التركيب بلا مريض مختار يُعاد التوجيه تلقائياً إلى آخر مريض مُدار
 * (ذاكرة محلية، بشرط بقائه ضمن قائمة العيادة)، والاختيار يحفظ الذاكرة.
 */
export function PatientPicker({
  basePath,
  selectedPatientId,
  className,
}: PatientPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // التوجيه الافتراضي مرة واحدة فقط — بعد أول قائمة ناجحة.
  const redirectAttempted = useRef(false);

  const load = useCallback(async (search: string) => {
    setError(null);
    try {
      const res = await fetch(
        `/api/patients${search ? `?q=${encodeURIComponent(search)}` : ""}`,
      );
      if (!res.ok) {
        setError("تعذر تحميل قائمة المرضى، حاول مرة أخرى");
        return;
      }
      const data = (await res.json()) as { patients: PatientDto[] };
      setPatients(data.patients);
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => void load(query.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query, load]);

  // التوجيه الافتراضي لآخر مريض مُدار — بعد أول قائمة، وبلا مريض في العنوان.
  useEffect(() => {
    if (redirectAttempted.current || !patients || selectedPatientId) return;
    redirectAttempted.current = true;
    const last = pickLastKnownPatient(window.localStorage, patients);
    if (last && last !== selectedPatientId) {
      router.replace(`${basePath}?patient=${encodeURIComponent(last)}`);
    }
  }, [patients, selectedPatientId, basePath, router]);

  function selectPatient(patient: PatientDto) {
    saveLastPatientId(window.localStorage, patient.id);
    router.push(`${basePath}?patient=${encodeURIComponent(patient.id)}`);
  }

  return (
    <section
      aria-label="اختيار المريض"
      className={cn(
        "rounded-panel border border-warm-200 bg-surface-raised shadow-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-warm-200 px-4 py-3">
        <Search size={18} className="text-steel-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث بالاسم أو الهاتف…"
          aria-label="بحث في المرضى"
          className="focus-ring w-full rounded-field bg-transparent py-1.5 text-sm text-ink-900 outline-none placeholder:text-steel-400"
        />
      </div>

      {error && (
        <p role="alert" className="px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      {patients === null && !error && (
        <p className="px-4 py-3 text-sm text-steel-500">جارٍ تحميل المرضى…</p>
      )}

      {patients !== null && patients.length === 0 && (
        <p className="px-4 py-3 text-sm text-steel-500">
          لا مرضى مطابقين للبحث.
        </p>
      )}

      {patients !== null && patients.length > 0 && (
        <ul className="max-h-72 divide-y divide-warm-100 overflow-y-auto">
          {patients.map((patient) => {
            const active = patient.id === selectedPatientId;
            return (
              <li key={patient.id}>
                <button
                  type="button"
                  onClick={() => selectPatient(patient)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-sm transition-colors hover:bg-surface-hover",
                    active
                      ? "bg-primary-50 font-semibold text-primary-800"
                      : "text-ink-900",
                  )}
                >
                  <span className="truncate">{patient.name}</span>
                  <span className="numeric text-xs text-steel-500">
                    {patient.phone ?? "—"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
