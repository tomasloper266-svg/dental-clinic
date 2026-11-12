import { NextRequest, NextResponse } from "next/server";
import { createSupportRequest } from "@/lib/auth/recovery";

// طلب دعم — مسار التحقق من ملكية العيادة حين لا تتوفر قناة موثقة.
// يُخزَّن الطلب في قاعدة البيانات ويُعالج من فريق الدعم.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const result = await createSupportRequest({
    clinicName: typeof raw.clinicName === "string" ? raw.clinicName : "",
    contactEmail:
      typeof raw.contactEmail === "string" && raw.contactEmail.trim()
        ? raw.contactEmail
        : undefined,
    contactPhone:
      typeof raw.contactPhone === "string" && raw.contactPhone.trim()
        ? raw.contactPhone
        : undefined,
    message: typeof raw.message === "string" ? raw.message : "",
  });

  if ("code" in result) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json(
    { ok: true, message: "وصل طلبك إلى فريق الدعم — سنتواصل معك للتحقق من الملكية" },
    { status: 201 },
  );
}
