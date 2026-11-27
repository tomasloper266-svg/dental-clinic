import { screen, fireEvent, waitFor } from "@testing-library/react";
import { mount } from "./ui";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import RecordPaymentModal from "@/components/finance/RecordPaymentModal";
import NewInvoiceModal from "@/components/finance/NewInvoiceModal";
import { CurrencyProvider } from "@/components/ui/CurrencyContext";
import { ToastProvider } from "@/components/ui/Toast";
import {
  isDateInputFuture,
  parseDateInputValue,
  toDateInputValue,
} from "@/lib/dates";
import type { PatientDto } from "@/lib/services/patients";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/finance",
}));

// سيناريو الخطأ 15 (سجل art_PmoOaaeq): نموذجا الدفع والفاتورة كانا يرفضان
// التاريخ الافتراضي «اليوم» في الساعات الأولى من اليوم لأن المقارنة كانت تُقيّم
// التاريخ بوقت ثابت (ظهراً) مقابل الوقت الحالي فيحسبه مستقبلاً. الإصلاح:
// تحقق موحّد في lib/dates.ts يقارن يوماً بيوم بلا أي مكوّن وقت، ولحظة التخزين
// منتصف ليل UTC فتبقى ماضية أي كانت ساعة الإدخال.

const patient: PatientDto = {
  id: "p1",
  name: "سارة التسوية",
  birthYear: null,
  phone: null,
  address: null,
  medicalNotes: null,
  gender: null,
  secondaryPhone: null,
  homePhone: null,
  email: null,
  nationalId: null,
  bloodType: null,
  allergies: null,
  chronicDiseases: null,
  emergencyContacts: null,
  fileNo: null,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
};

function todayValue(): string {
  return toDateInputValue(new Date());
}

function tomorrowValue(): string {
  return toDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

describe("التحقق الزمني الموحّد (lib/dates) — يوم بيوم بلا وقت", () => {
  const dawn = new Date("2026-11-15T00:12:00.000Z"); // فجر اليوم — شرط الخطأ الموثق

  it("تاريخ اليوم يُقبل قبل الظهر (شرط إعادة إنتاج الخطأ 15)", () => {
    expect(isDateInputFuture("2026-11-15", dawn)).toBe(false);
  });

  it("تاريخ اليوم يُقبل أي كانت الساعة — حتى قبيل منتصف الليل", () => {
    expect(
      isDateInputFuture("2026-11-15", new Date("2026-11-15T23:59:59.000Z")),
    ).toBe(false);
  });

  it("غداً يُرفض أياً كانت الساعة", () => {
    expect(isDateInputFuture("2026-11-16", dawn)).toBe(true);
    expect(
      isDateInputFuture("2026-11-16", new Date("2026-11-15T23:59:59.000Z")),
    ).toBe(true);
  });

  it("أمس ماضٍ دائماً", () => {
    expect(isDateInputFuture("2026-11-14", dawn)).toBe(false);
  });

  it("لحظة التخزين منتصف ليل UTC — تمرّ تحقق خادم الدفتر أي كانت ساعة الإدخال", () => {
    const instant = parseDateInputValue("2026-11-15").getTime();
    expect(instant).toBeLessThanOrEqual(dawn.getTime());
  });
});

describe("نموذج تسديد الدفعة — التحقق الزمني", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entry: { id: "e1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  async function renderModal() {
    mount(
      <CurrencyProvider currency="USD" usdRate={1}>
        <ToastProvider>
          <RecordPaymentModal
            onClose={() => {}}
            onSaved={() => {}}
            usdRate={1}
            patients={[patient]}
            invoices={[]}
          />
        </ToastProvider>
      </CurrencyProvider>,
    );
    await userEvent.type(screen.getByLabelText("المبلغ *"), "100");
  }

  it("غداً يُرفض برسالة التاريخ المستقبلي دون أي طلب شبكي", async () => {
    await renderModal();
    fireEvent.change(screen.getByLabelText("التاريخ"), {
      target: { value: tomorrowValue() },
    });
    await userEvent.click(screen.getByRole("button", { name: "تسجيل الدفعة" }));
    // الرسالة تظهر في حقل التاريخ وفي تنبيه الإرسال معاً
    expect(
      screen.getAllByText("لا يمكن تسجيل الدفعة بتاريخ مستقبلي").length,
    ).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("تاريخ اليوم يُقبل ويُحفظ بأي ساعة — اللحظة المرسلة منتصف ليل اليوم", async () => {
    await renderModal();
    fireEvent.change(screen.getByLabelText("التاريخ"), {
      target: { value: todayValue() },
    });
    await userEvent.click(screen.getByRole("button", { name: "تسجيل الدفعة" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { createdAt: string };
    expect(body.createdAt).toBe(`${todayValue()}T00:00:00.000Z`);
  });
});

describe("نموذج فاتورة جديدة — التحقق الزمني", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entry: { id: "e2" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  async function renderModal() {
    mount(
      <CurrencyProvider currency="USD" usdRate={1}>
        <ToastProvider>
          <NewInvoiceModal
            onClose={() => {}}
            onIssued={() => {}}
            patients={[patient]}
          />
        </ToastProvider>
      </CurrencyProvider>,
    );
    await userEvent.type(screen.getByLabelText("الإجراء"), "تبييض ليزر");
    await userEvent.type(screen.getByLabelText("المبلغ بالدولار"), "100");
  }

  it("غداً يُرفض برسالة التاريخ المستقبلي دون أي طلب شبكي", async () => {
    await renderModal();
    fireEvent.change(screen.getByLabelText("التاريخ"), {
      target: { value: tomorrowValue() },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "إصدار الفاتورة" }),
    );
    // الرسالة تظهر في حقل التاريخ وفي تنبيه الإرسال معاً
    expect(
      screen.getAllByText("لا يمكن الإصدار بتاريخ مستقبلي").length,
    ).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("تاريخ اليوم يُقبل ويُحفظ بأي ساعة — اللحظة المرسلة منتصف ليل اليوم", async () => {
    await renderModal();
    fireEvent.change(screen.getByLabelText("التاريخ"), {
      target: { value: todayValue() },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "إصدار الفاتورة" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { createdAt: string };
    expect(body.createdAt).toBe(`${todayValue()}T00:00:00.000Z`);
  });
});
