import { describe, expect, it } from "vitest";
import {
  LAST_PATIENT_KEY,
  clearLastPatientId,
  pickLastKnownPatient,
  readLastPatientId,
  saveLastPatientId,
} from "@/lib/patients/last-patient";

/** تخزين حقيقي السلوك في ذاكرة — بلا jsdom */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("readLastPatientId / saveLastPatientId", () => {
  it("يقرأ ما حُفظ بنفس المفتاح المعروف", () => {
    const storage = fakeStorage();
    saveLastPatientId(storage, "p_123");
    expect(storage.getItem(LAST_PATIENT_KEY)).toBe("p_123");
    expect(readLastPatientId(storage)).toBe("p_123");
  });

  it("يعيد null لغياب القيمة أو فراغها", () => {
    expect(readLastPatientId(fakeStorage())).toBeNull();
    expect(
      readLastPatientId(fakeStorage({ [LAST_PATIENT_KEY]: "" })),
    ).toBeNull();
  });

  it("التحديث يستبدل القيمة السابقة", () => {
    const storage = fakeStorage({ [LAST_PATIENT_KEY]: "p_old" });
    saveLastPatientId(storage, "p_new");
    expect(readLastPatientId(storage)).toBe("p_new");
  });

  it("الحذف يمحو الذاكرة", () => {
    const storage = fakeStorage({ [LAST_PATIENT_KEY]: "p_123" });
    clearLastPatientId(storage);
    expect(readLastPatientId(storage)).toBeNull();
  });
});

describe("pickLastKnownPatient", () => {
  const patients = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("يوجّه لآخر مريض محفوظ ما دام في قائمة العيادة", () => {
    const storage = fakeStorage({ [LAST_PATIENT_KEY]: "b" });
    expect(pickLastKnownPatient(storage, patients)).toBe("b");
  });

  it("يرفض معرّفاً لم يعد في القائمة — لا توجيه لمعرّف غريب", () => {
    const storage = fakeStorage({ [LAST_PATIENT_KEY]: "deleted" });
    expect(pickLastKnownPatient(storage, patients)).toBeNull();
  });

  it("يعيد null بلا ذاكرة محفوظة", () => {
    expect(pickLastKnownPatient(fakeStorage(), patients)).toBeNull();
  });
});
