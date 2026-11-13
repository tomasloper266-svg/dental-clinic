import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MicButton } from "@/components/ui/MicButton";
import { useVoiceInput } from "@/lib/use-voice-input";
import type {
  RecognitionLike,
  SpeechEventLike,
} from "@/lib/voice-input";

// محاكاة دنيا لكائن التعرف الصوتي — نفس دورة الحياة التي يستهلكها hook.
class FakeRecognition implements RecognitionLike {
  lang = "";
  continuous = false;
  interimResults = false;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  onresult: ((event: SpeechEventLike) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
}

// مُنشئ حقيقي — الـ hook يستخدم new، و vi.fn غير قابل للاستدعاء بـ new.
// الـ getCtor مُصنع يُعيد المُنشئ — بنفس شكل getRecognitionCtor.
function makeCtor() {
  const instances: FakeRecognition[] = [];
  class InjectedRecognition extends FakeRecognition {
    constructor() {
      super();
      instances.push(this);
    }
  }
  return {
    ctor: InjectedRecognition,
    getCtor: () => InjectedRecognition,
    instances,
  };
}

function finalEvent(text: string): SpeechEventLike {
  return {
    resultIndex: 0,
    results: {
      0: { isFinal: true, 0: { transcript: text }, length: 1 },
      length: 1,
    },
  };
}

// حقل مرافق يحاكي أي حقل سريري يُدار بحالة أب.
function Harness({
  getCtor,
  initial = "",
}: {
  getCtor?: (() => new () => FakeRecognition) | null;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <input id="clinical-field" value={value} onChange={(e) => setValue(e.target.value)} readOnly={false} />
      {getCtor === null ? null : (
        <MicButton
          targetId="clinical-field"
          value={value}
          onChange={setValue}
          getCtor={getCtor ?? undefined}
        />
      )}
      <p data-testid="value">{value}</p>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MicButton", () => {
  it("يُخفى كلياً حين لا يدعم المتصفح Web Speech API", () => {
    const { instances } = makeCtor();
    render(<Harness getCtor={null} initial="حشو" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // الحقل نفسه لا يتأثر إطلاقاً — بلا كسر.
    expect(screen.getByTestId("value")).toHaveTextContent("حشو");
    expect(instances).toHaveLength(0);
  });

  it("يظهر بعد التركيب حين يدعم المتصفح التعرف الصوتي", async () => {
    const { getCtor, instances } = makeCtor();
    render(<Harness getCtor={getCtor} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /بدء الإدخال الصوتي/ }),
      ).toBeInTheDocument(),
    );
    // لا جلسة ميكروفون قبل النقر — التعرف على الدعم لا يبني كائناً.
    expect(instances).toHaveLength(0);
  });

  it("يغير حالته أثناء التسجيل (نص ولون و aria-pressed)", async () => {
    const { getCtor, instances } = makeCtor();
    render(<Harness getCtor={getCtor} />);
    const button = await screen.findByRole("button", {
      name: /بدء الإدخال الصوتي/,
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /إيقاف الإدخال الصوتي/ }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("جارٍ التسجيل");
    expect(instances[0].start).toHaveBeenCalled();
    expect(instances[0].lang).toBe("ar-SA");
    expect(instances[0].continuous).toBe(true);
    expect(instances[0].interimResults).toBe(true);
  });

  it("يُدرج النص المنقول في موضع المؤشر داخل الحقل", async () => {
    const { getCtor, instances } = makeCtor();
    render(<Harness getCtor={getCtor} initial="حشو سابق" />);
    const button = await screen.findByRole("button", {
      name: /بدء الإدخال الصوتي/,
    });
    fireEvent.click(button);
    const field = document.getElementById("clinical-field") as HTMLInputElement;
    // المؤشر بين «حشو» و«سابق»
    field.selectionStart = 4;
    await waitFor(() => expect(instances[0].onresult).not.toBeNull());
    instances[0].onresult?.(finalEvent("تسوس"));
    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("حشو تسوس سابق"),
    );
  });

  it("يُلحق النص المنقول بالنص الموجود بلا مؤشر", async () => {
    const { getCtor, instances } = makeCtor();
    render(<Harness getCtor={getCtor} initial="حشو" />);
    const button = await screen.findByRole("button", {
      name: /بدء الإدخال الصوتي/,
    });
    fireEvent.click(button);
    await waitFor(() => expect(instances[0].onresult).not.toBeNull());
    instances[0].onresult?.(finalEvent("تسوس المضغ"));
    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("حشو تسوس المضغ"),
    );
  });

  it("يتجاهل النتائج المؤقتة حتى لا يُدرج الكلام مرتين", async () => {
    const { getCtor, instances } = makeCtor();
    render(<Harness getCtor={getCtor} />);
    const button = await screen.findByRole("button", {
      name: /بدء الإدخال الصوتي/,
    });
    fireEvent.click(button);
    await waitFor(() => expect(instances[0].onresult).not.toBeNull());
    instances[0].onresult?.({
      resultIndex: 0,
      results: {
        0: { isFinal: false, 0: { transcript: "تسو", }, length: 1 },
        length: 1,
      },
    });
    expect(screen.getByTestId("value")).toHaveTextContent("");
  });

  it("يوقف التسجيل بالنقر الثاني ويعيد الحالة", async () => {
    const { getCtor, instances } = makeCtor();
    render(<Harness getCtor={getCtor} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /بدء الإدخال الصوتي/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /إيقاف الإدخال الصوتي/ }),
    );
    expect(instances[0].stop).toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /بدء الإدخال الصوتي/ }),
      ).toHaveAttribute("aria-pressed", "false"),
    );
  });

  it("يعرض رسالة خطأ عربية عند رفض إذن المايكروفون", async () => {
    const { getCtor, instances } = makeCtor();
    render(<Harness getCtor={getCtor} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /بدء الإدخال الصوتي/ }),
    );
    await waitFor(() => expect(instances[0].onerror).not.toBeNull());
    instances[0].onerror?.({ error: "not-allowed" });
    // المتصفح ينهي الجلسة بعد الخطأ — onend يليه دائماً.
    instances[0].onend?.();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("المايكروفون"),
    );
  });

  it("يحتفظ بالنص قابل للتعديل بعد الإدراج — الكتابة اليدوية تعمل", async () => {
    const { getCtor, instances } = makeCtor();
    render(<Harness getCtor={getCtor} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /بدء الإدخال الصوتي/ }),
    );
    await waitFor(() => expect(instances[0].onresult).not.toBeNull());
    instances[0].onresult?.(finalEvent("تسوس"));
    await waitFor(() =>
      expect(screen.getByTestId("value")).toHaveTextContent("تسوس"),
    );
    fireEvent.change(
      document.getElementById("clinical-field") as HTMLInputElement,
      { target: { value: "تسوس عميق" } },
    );
    expect(screen.getByTestId("value")).toHaveTextContent("تسوس عميق");
  });
});

describe("useVoiceInput — بلا حقن (متصفح الاختبار)", () => {
  function Probe() {
    const { supported, listening } = useVoiceInput({ onTranscript: () => {} });
    return (
      <p data-testid="probe">
        {String(supported)}-{String(listening)}
      </p>
    );
  }

  it("يعيد supported=false في jsdom الذي لا يدعم التعرف الصوتي", async () => {
    render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId("probe")).toHaveTextContent("false-false"),
    );
  });
});
