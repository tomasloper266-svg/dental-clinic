"use client";

import { useEffect, useState } from "react";

export type PatientOption = {
  id: string;
  name: string;
  phone: string | null;
};

const SEARCH_DEBOUNCE_MS = 300;

/** بحث المرضى بالاسم أو الهاتف — تراجع 300ms وإلغاء الاستجابات المتقادمة. */
export function usePatientSearch(
  query: string,
  enabled = true,
): PatientOption[] {
  const [options, setOptions] = useState<PatientOption[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || !trimmed) {
      setOptions([]);
      return;
    }
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/patients?q=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { patients: PatientOption[] };
        if (!stale) setOptions(data.patients);
      } catch {
        if (!stale) setOptions([]);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, enabled]);

  return options;
}
