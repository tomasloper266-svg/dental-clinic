import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { emitLedgerChanged } from "@/lib/ledger-events";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard",
}));

// انحدار ملاحظة الجولة (قسم خامساً في سجل art_PmoOaaeq): شارة المستحقات في
// السايدبار بقيت $697 حتى إعادة تحميل كاملة ثم استقرت $797 — الملخص كان
// يتحدث عند أول قيد في الجلسة فقط. الآن يُجلب الملخص من جديد بعد كل كتابة
// في الدفتر (حدث ledger:changed) فتعكس البطاقة آخر عملية فوراً.

function summaryResponse(outstandingDuesSyp: number, patientsWithDues: number) {
  return { ok: true, json: async () => ({ outstandingDuesSyp, patientsWithDues }) };
}

describe("شارة المستحقات تتجدد بعد كل كتابة في الدفتر", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  function renderShell() {
    render(
      <AppShell
        userName="د. سامر"
        clinicName="عيادة النور"
        badges={{ waitlist: 0, lowStock: 0, dues: 4 }}
        outstandingDuesSyp={697}
        usdRate={1}
      >
        <div>محتوى الصفحة</div>
      </AppShell>,
    );
  }

  it("البطاقة تعرض قيمة التخطيط الخادم قبل أي كتابة", () => {
    renderShell();
    expect(screen.getByText(/697/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("كل كتابة في الدفتر تُجلب الملخص من جديد وتُحدّث البطاقة فوراً بلا إعادة تحميل", async () => {
    renderShell();

    // القيد الأول: 697 → 797 (الأرقام المرجعية من الجولة)
    fetchMock.mockResolvedValueOnce(summaryResponse(797, 5));
    act(() => emitLedgerChanged());
    await waitFor(() => expect(screen.getByText(/797/)).toBeInTheDocument());
    expect(screen.queryByText(/697/)).not.toBeInTheDocument();

    // كتابة ثانية في الجلسة نفسها — يجب أن تتجدد كذلك (كانت تتوقف بعد الأولى)
    fetchMock.mockResolvedValueOnce(summaryResponse(807, 6));
    act(() => emitLedgerChanged());
    await waitFor(() => expect(screen.getByText(/807/)).toBeInTheDocument());
    expect(screen.queryByText(/797/)).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("/api/dues/summary");
  });
});
