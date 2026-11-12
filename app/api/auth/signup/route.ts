import { NextRequest, NextResponse } from "next/server";
import { parseSignup } from "@/lib/auth/signup";
import { createClinicWithOwner } from "@/lib/auth/create-clinic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseSignup(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const clinicId = await createClinicWithOwner(parsed.value);
    return NextResponse.json({ clinicId }, { status: 201 });
  } catch (err) {
    // خطأ غير متوقع (اتصال قاعدة بيانات، قيد، ...) — يُسجل ولا يُكتم.
    console.error("[signup] failed to create clinic:", err);
    return NextResponse.json(
      { error: "تعذر إنشاء العيادة، حاول مرة أخرى" },
      { status: 500 },
    );
  }
}
