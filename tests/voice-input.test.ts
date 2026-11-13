import { describe, expect, it } from "vitest";
import {
  collectFinalTranscript,
  getRecognitionCtor,
  insertDictation,
  recognitionErrorMessage,
  type SpeechEventLike,
} from "@/lib/voice-input";

function speechEvent(
  results: Array<{ transcript: string; isFinal: boolean }>,
  resultIndex = 0,
): SpeechEventLike {
  const items = results.map((r) => ({
    isFinal: r.isFinal,
    0: { transcript: r.transcript },
    length: 1,
  }));
  return { resultIndex, results: { ...items, length: items.length } };
}

describe("insertDictation", () => {
  it("يُلحق النص بالنص الموجود بلا مؤشر", () => {
    expect(insertDictation("تسوس", "حشو", null)).toBe("تسوس حشو");
  });

  it("يُلحق النص بحقل فارغ دون مسافة بادئة", () => {
    expect(insertDictation("", "تسوس سطح مضغي", null)).toBe("تسوس سطح مضغي");
  });

  it("يُدرج النص في موضع المؤشر", () => {
    expect(insertDictation("حشو سابق", "تسوس", 4)).toBe("حشو تسوس سابق");
  });

  it("يُدرج النص في بداية الحقل", () => {
    expect(insertDictation("سابق", "تسوس", 0)).toBe("تسوس سابق");
  });

  it("يعتني بالمسافات من الجانبين دون مضاعفتها", () => {
    expect(insertDictation("حشو ", "تسوس", null)).toBe("حشو تسوس");
    expect(insertDictation("حشو", "تسوس ", null)).toBe("حشو تسوس");
    expect(insertDictation("حشو  ", " تسوس  ", null)).toBe("حشو  تسوس"); // النص المكتوب يُحفظ كما هو
  });

  it("يطوي المسافات المتكررة داخل النص المنقول", () => {
    expect(insertDictation("", "تسوس   سطح", null)).toBe("تسوس سطح");
  });

  it("يتجاهل النص الفارغ أو المسافات وحدها", () => {
    expect(insertDictation("حشو", "   ", null)).toBe("حشو");
    expect(insertDictation("حشو", "", 2)).toBe("حشو");
  });

  it("يعامل المؤشر خارج النطاق كإلحاق", () => {
    expect(insertDictation("حشو", "تسوس", 99)).toBe("حشو تسوس");
  });

  it("يحافظ على النص العربي المركب كما هو", () => {
    expect(insertDictation("خلع سن ٣٦", "حشو ٢٦ أو", null)).toBe(
      "خلع سن ٣٦ حشو ٢٦ أو",
    );
  });
});

describe("collectFinalTranscript", () => {
  it("يجمع النص النهائي فقط ويتجاهل النتائج المؤقتة", () => {
    const event = speechEvent([
      { transcript: "تسوس", isFinal: true },
      { transcript: "سطح", isFinal: false },
      { transcript: "المضغ", isFinal: true },
    ]);
    expect(collectFinalTranscript(event)).toBe("تسوس المضغ");
  });

  it("يعيد نصاً فارغاً حين لا نتائج نهائية", () => {
    const event = speechEvent([{ transcript: "تسوس", isFinal: false }]);
    expect(collectFinalTranscript(event)).toBe("");
  });

  it("يبدأ من resultIndex ولا يعيد قراءة النتائج الأقدم", () => {
    const event = speechEvent(
      [
        { transcript: "أول", isFinal: true },
        { transcript: "ثانٍ", isFinal: true },
      ],
      1,
    );
    expect(collectFinalTranscript(event)).toBe("ثانٍ");
  });
});

describe("recognitionErrorMessage", () => {
  it("يرفض الإذن برسالة واضحة", () => {
    expect(recognitionErrorMessage("not-allowed")).toContain("المايكروفون");
  });

  it("لا يعرض رسالة للانقطاع المتعمد", () => {
    expect(recognitionErrorMessage("aborted")).toBe("");
  });

  it("لأي خطأ غير معروف رسالة عامة", () => {
    expect(recognitionErrorMessage("unknown-code")).toBe(
      "تعذر الإدخال الصوتي",
    );
    expect(recognitionErrorMessage(undefined)).toBe("تعذر الإدخال الصوتي");
  });
});

describe("getRecognitionCtor", () => {
  it("يقرأ webkitSpeechRecognition — كروم", () => {
    function Fake() {}
    expect(
      getRecognitionCtor({ webkitSpeechRecognition: Fake }) !== null,
    ).toBe(true);
  });

  it("يعيد null بلا دعم — فايرفوكس", () => {
    expect(getRecognitionCtor({})).toBe(null);
  });
});
