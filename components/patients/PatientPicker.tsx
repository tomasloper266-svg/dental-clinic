"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PatientDto } from "@/lib/services/patients";
import {
  pickLastKnownPatient,
  saveLastPatientId,
} from "@/lib/patients/last-patient";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";

const SEARCH_DEBOUNCE_MS = 300;

type PatientPickerProps = {
  /** أساس المسار الذي يعمل عليه المنتقي — /chart (والملف الكامل للمريض) */
  basePath: string;
  /** المريض المختار حالياً في الصفحة (من ?patient=) */
  selectedPatientId?: string;
  className?: string;
};

/**
 * منتقي المريض — مصدر واحد للواجهة يشاركه /chart وملف المريض الكامل.
 * عند التركيب بلا مريض مختار يُعاد التوجيه تلقائياً إلى آخر مريض مُدار
 * (ذاكرة محلية، بشرط بقائه ضمن قائمة العيادة)، والاختيار يحفظ الذاكرة.
 */
export function PatientPicker({
  basePath,
  selectedPatientId,
  className,
}: PatientPickerProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // التوجيه الافتراضي مرة واحدة فقط — بعد أول قائمة ناجحة.
  const redirectAttempted = useRef(false);

  const load = useCallback(
    async (search: string) => {
      setError(null);
      try {
        const res = await fetch(
          `/api/patients${search ? `?q=${encodeURIComponent(search)}` : ""}`,
        );
        if (!res.ok) {
          setError(t("picker.error.load"));
          return;
        }
        const data = (await res.json()) as { patients: PatientDto[] };
        setPatients(data.patients);
      } catch {
        setError(t("common.error.network"));
      }
    },
    [t],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(query.trim()), SEARCH_DEBOUNCE_MS);
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
      aria-label={t("picker.aria")}
      className={cn(
        "rounded-panel border-warm-200 bg-surface-raised border shadow-xs",
        className,
      )}
    >
      <div className="border-warm-200 flex items-center gap-2 border-b px-4 py-3">
        <Search size={18} className="text-steel-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("picker.placeholder")}
          aria-label={t("picker.searchAria")}
          className="focus-ring rounded-field text-ink-900 placeholder:text-steel-400 w-full bg-transparent py-1.5 text-sm outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-danger-700 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {patients === null && !error && (
        <p className="text-steel-500 px-4 py-3 text-sm">
          {t("picker.loading")}
        </p>
      )}

      {patients !== null && patients.length === 0 && (
        <p className="text-steel-500 px-4 py-3 text-sm">
          {t("picker.noMatches")}
        </p>
      )}

      {patients !== null && patients.length > 0 && (
        <ul className="divide-warm-100 max-h-72 divide-y overflow-y-auto">
          {patients.map((patient) => {
            const active = patient.id === selectedPatientId;
            return (
              <li key={patient.id}>
                <button
                  type="button"
                  onClick={() => selectPatient(patient)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "hover:bg-surface-hover flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start text-sm transition-colors",
                    active
                      ? "bg-primary-50 text-primary-800 font-semibold"
                      : "text-ink-900",
                  )}
                >
                  <span className="truncate">{patient.name}</span>
                  <span className="numeric text-steel-500 text-xs">
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
