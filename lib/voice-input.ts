// أنواع Web Speech API الدنيا والمنطق النقي للإدخال الصوتي — بلا أي DOM
// مباشر هنا ليكون قابل الاختبار بالكامل. المتصفح يوفر البنية عبر
// window.SpeechRecognition أو window.webkitSpeechRecognition (كروم وإنترنت
// إكسبلورر القديم)؛ فايرفوكس بلا دعم فيُخفى الزر بدل أي كسر.

export type SpeechAlternativeLike = { transcript: string };

export type SpeechResultLike = {
  isFinal: boolean;
  0: SpeechAlternativeLike;
  length: number;
};

export type SpeechEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResultLike };
};

export type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

export type RecognitionCtor = new () => RecognitionLike;

type SpeechWindow = {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

/** يقرأ مُنشئ التعرف الصوتي من النافذة — null حين لا يدعمه المتصفح. */
export function getRecognitionCtor(
  scope: SpeechWindow = (typeof window === "undefined"
    ? {}
    : window) as SpeechWindow,
): RecognitionCtor | null {
  const ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as RecognitionCtor) : null;
}

/**
 * يُدرج النص المنقول في موضع المؤشر داخل الحقل، أو يُلحقه بالنص الموجود
 * حين لا يوجد مؤشر. يعتني بالفواصل المسافية من الجانبين دون مضاعفتها.
 */
export function insertDictation(
  current: string,
  addition: string,
  caret: number | null,
): string {
  const text = addition.trim().replace(/\s+/g, " ");
  if (!text) return current;

  const at =
    caret === null || caret < 0 || caret > current.length
      ? current.length
      : caret;
  const before = current.slice(0, at);
  const after = current.slice(at);
  const padLeft = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const padRight = after.length > 0 && !/^\s/.test(after) ? " " : "";
  return `${before}${padLeft}${text}${padRight}${after}`;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "إذن المايكروفون مرفوض — فعّله من إعدادات المتصفح",
  "service-not-allowed": "خدمة التعرف الصوتي غير متاحة في هذا المتصفح",
  "no-speech": "لم يُكتشف كلام — حاول مجدداً",
  "audio-capture": "لا مايكروفون متاح",
  network: "تعذر الوصول لخدمة التعرف الصوتي",
  aborted: "",
};

/** رسالة عربية مقروءة لخطأ التعرف الصوتي — نص فارغ يعني تجاهل الخطأ. */
export function recognitionErrorMessage(code: string | undefined): string {
  if (!code) return "تعذر الإدخال الصوتي";
  return ERROR_MESSAGES[code] ?? "تعذر الإدخال الصوتي";
}

/**
 * يجمع النص النهائي من حدث نتيجة — النتائج غير النهائية (interim) تُتجاهل
 * حتى لا يُدرج الكلام مرتين.
 */
export function collectFinalTranscript(event: SpeechEventLike): string {
  let final = "";
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    if (result?.isFinal) final += `${result[0].transcript} `;
  }
  return final.trim();
}
