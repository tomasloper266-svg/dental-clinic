import { describe, expect, it } from "vitest";
import {
  damascusHour,
  normalizeArabic,
  pickBestWaitlistMatch,
  windowMatchesGap,
} from "@/lib/services/waitlist-matching";
import type { WaitlistCandidate } from "@/lib/services/waitlist-matching";

// ساعات العمل 07:00–14:00 UTC أي 10:00–17:00 بتوقيت دمشق (UTC+3).
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 5, 15, h, m));

function candidate(overrides: Partial<WaitlistCandidate>): WaitlistCandidate {
  return {
    id: "entry-1",
    patientId: "patient-1",
    patientName: "مريض",
    preferredWindow: "أي وقت",
    priority: 0,
    status: "WAITING",
    note: null,
    ...overrides,
  };
}

describe("مطابقة قائمة الانتظار — ساعة دمشق", () => {
  it("يحسب UTC+3 بلف الساعة حول منتصف الليل", () => {
    expect(damascusHour(at(7, 0))).toBe(10);
    expect(damascusHour(at(13, 30))).toBe(16);
    expect(damascusHour(new Date(Date.UTC(2026, 5, 15, 22, 0)))).toBe(1);
  });
});

describe("مطابقة قائمة الانتظار — تطبيع النص العربي", () => {
  it("يزيل التشكيل ويوحد الألف والياء", () => {
    expect(normalizeArabic("صباحاً مُبكِّراً")).toBe("صباحا مبكرا");
    expect(normalizeArabic("في أي وقت")).toBe("في اي وقت");
  });
});

describe("مطابقة قائمة الانتظار — قراءة النافذة المفضلة", () => {
  it("«أي وقت» يوافق أي فجوة", () => {
    expect(windowMatchesGap("أي وقت", at(7))).toBe(true);
    expect(windowMatchesGap("في أي وقت ما عدا الأحد", at(13))).toBe(true);
  });

  it("النص غير المقروء يُعامل كمرونة كاملة", () => {
    expect(windowMatchesGap("", at(9))).toBe(true);
    expect(windowMatchesGap("أفضل ألا يكون يوم الجمعة", at(9))).toBe(true);
  });

  it("«صباح» يوافق الصباح المحلي فقط", () => {
    expect(windowMatchesGap("صباح الثلاثاء", at(7))).toBe(true); // 10:00 محلياً
    expect(windowMatchesGap("صباحاً", at(8, 30))).toBe(true); // 11:30 محلياً
    expect(windowMatchesGap("صباح الثلاثاء", at(10))).toBe(false); // 13:00 محلياً
  });

  it("«مساء» يوافق العصر المتأخر فصاعداً", () => {
    expect(windowMatchesGap("مساء", at(13, 30))).toBe(true); // 16:30 محلياً
    expect(windowMatchesGap("مساء", at(8))).toBe(false); // 11:00 محلياً
  });

  it("«ظهر» و«عصر» يغطيان منتصف اليوم", () => {
    expect(windowMatchesGap("عصرا", at(9, 30))).toBe(true); // 12:30 محلياً
    expect(windowMatchesGap("الظهر", at(11))).toBe(true); // 14:00 محلياً
    expect(windowMatchesGap("ظهرا", at(7))).toBe(false); // 10:00 محلياً
  });

  it("«بعد الرابعة» يفسَّر 4 عصراً — 16:00 محلياً (أرقام بالحروف)", () => {
    expect(windowMatchesGap("أي وقت بعد الرابعة", at(13, 30))).toBe(true);
    expect(windowMatchesGap("أي وقت بعد الرابعة", at(11))).toBe(false); // 14:00 محلياً
    expect(windowMatchesGap("قبل الخامسة", at(11))).toBe(true); // 14:00 محلياً
    expect(windowMatchesGap("قبل الخامسة", at(14))).toBe(false); // 17:00 محلياً
    expect(windowMatchesGap("الساعة الثانية عشر", at(8, 30))).toBe(true); // 11:30 محلياً
  });

  it("«قبل 12» يقبل ما قبل الساعة الثانية عشرة محلياً", () => {
    expect(windowMatchesGap("قبل 12", at(8, 30))).toBe(true); // 11:30 محلياً
    expect(windowMatchesGap("قبل 12", at(10))).toBe(false); // 13:00 محلياً
  });

  it("ذكر ساعة بلا اتجاه يتسامح ساعة كاملة حولها", () => {
    expect(windowMatchesGap("الساعة 11", at(8))).toBe(true); // 11:00 محلياً
    expect(windowMatchesGap("الساعة 11", at(7))).toBe(true); // 10:00 محلياً
    expect(windowMatchesGap("الساعة 11", at(10))).toBe(false); // 13:00 محلياً
  });

  it("التشكيل والهمزات لا تمنع القراءة", () => {
    expect(windowMatchesGap("صباحاً جداً", at(7, 30))).toBe(true);
    expect(windowMatchesGap("أي وقت", at(12))).toBe(true);
  });

  it("أسماء الأيام لا تُقرأ ساعات — «الاثنين» ليس الساعة 2 و«الثلاثاء» ليست 3", () => {
    // 10:15 UTC = 13:15 محلياً — ليست صباحاً رغم ورود اسم اليوم.
    expect(windowMatchesGap("صباح الاثنين", at(10, 15))).toBe(false);
    expect(windowMatchesGap("صباح الاثنين", at(7))).toBe(true);
    // «الثلاثاء» لو قُرئت «ثلاث» لتعنّت 15:00 محلياً — يجب أن تبقى مرونة.
    expect(windowMatchesGap("أي يوم عدا الثلاثاء", at(9))).toBe(true);
  });
});

describe("مطابقة قائمة الانتظار — اختيار الأفضل", () => {
  it("يختار الأعلى أولوية بين المطابقين", () => {
    const best = pickBestWaitlistMatch(
      [
        candidate({ id: "low", priority: 1 }),
        candidate({ id: "high", patientName: "الأعلى", priority: 9 }),
      ],
      at(9),
      30,
    );
    expect(best?.id).toBe("high");
  });

  it("التعادل بالأولوية يفضّل من وصل أولاً (ترتيب الإدخال المستقر)", () => {
    const best = pickBestWaitlistMatch(
      [
        candidate({ id: "first", priority: 5 }),
        candidate({ id: "second", priority: 5 }),
      ],
      at(9),
      30,
    );
    expect(best?.id).toBe("first");
  });

  it("نافذة الأولوية الأعلى غير المطابقة لا تحجب المطابق الأدنى", () => {
    const best = pickBestWaitlistMatch(
      [
        candidate({ id: "evening", preferredWindow: "مساء", priority: 10 }),
        candidate({ id: "flexible", preferredWindow: "أي وقت", priority: 2 }),
      ],
      at(8), // 11:00 محلياً — ليست مساءً
      30,
    );
    expect(best?.id).toBe("flexible");
  });

  it("يستبعد المحجوزين (BOOKED) والمُعروض لهم (OFFERED)", () => {
    const best = pickBestWaitlistMatch(
      [
        candidate({ id: "booked", status: "BOOKED", priority: 10 }),
        candidate({ id: "offered", status: "OFFERED", priority: 8 }),
      ],
      at(9),
      30,
    );
    expect(best).toBeNull();
  });

  it("فجوة أقصر من الحد الأدنى لا تُملأ مهما توفر مرشحون", () => {
    const best = pickBestWaitlistMatch(
      [candidate({ id: "any", priority: 10 })],
      at(9),
      15,
    );
    expect(best).toBeNull();
  });

  it("لا مرشحون يطابقون — الفجوة تبقى فجوة", () => {
    const best = pickBestWaitlistMatch(
      [candidate({ id: "evening", preferredWindow: "مساء" })],
      at(7), // 10:00 محلياً
      30,
    );
    expect(best).toBeNull();
  });

  it("قائمة فارغة تُرجع null بلا أخطاء", () => {
    expect(pickBestWaitlistMatch([], at(9), 30)).toBeNull();
  });
});
