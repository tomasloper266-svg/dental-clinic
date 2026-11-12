import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientPicker } from "@/components/patients/PatientPicker";
import { LAST_PATIENT_KEY } from "@/lib/patients/last-patient";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

const PATIENTS = [
  { id: "a", name: "أحمد", birthYear: 1990, phone: "0501", address: null, medicalNotes: null },
  { id: "b", name: "سارة", birthYear: 1985, phone: "0502", address: null, medicalNotes: null },
];

function fetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ patients: PATIENTS }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("PatientPicker", () => {
  it("يحمّل القائمة ويعرض المرضى", async () => {
    vi.stubGlobal("fetch", fetchOk());
    render(<PatientPicker basePath="/chart" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /أحمد/ })).toBeInTheDocument(),
    );
  });

  it("اختيار مريض يحفظه آخر مريض مُدار ويوجّه لأساس المسار الحالي", async () => {
    vi.stubGlobal("fetch", fetchOk());
    render(<PatientPicker basePath="/plans" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /سارة/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /سارة/ }));
    expect(window.localStorage.getItem(LAST_PATIENT_KEY)).toBe("b");
    expect(push).toHaveBeenCalledWith("/plans?patient=b");
  });

  it("بلا مريض في العنوان يُعاد التوجيه لآخر مريض مُدار المتبقّي في القائمة", async () => {
    window.localStorage.setItem(LAST_PATIENT_KEY, "b");
    vi.stubGlobal("fetch", fetchOk());
    render(<PatientPicker basePath="/chart" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/chart?patient=b"));
  });

  it("لا توجيه تلقائي حين يكون مريض العنوان محدداً", async () => {
    vi.stubGlobal("fetch", fetchOk());
    render(<PatientPicker basePath="/chart" selectedPatientId="a" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /أحمد/ })).toBeInTheDocument(),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("فشل الشبكة يُظهر رسالة خطأ — لا صمت", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    render(<PatientPicker basePath="/chart" />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "تعذر الاتصال بالخادم",
      ),
    );
  });
});
