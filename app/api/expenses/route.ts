import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant/require-tenant";
import {
  createExpense,
  listExpenses,
  parseCreateExpense,
} from "@/lib/services/expenses";

// سجل مصاريف العيادة — إنشاء وعرض. الفئات ثابتة: إيجار/رواتب/مواد/أخرى.

export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (ctx === "LOCKED") {
    return NextResponse.json(
      { error: "التطبيق مقفل — أدخل الرمز الرقمي للفتح" },
      { status: 423 },
    );
  }
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  // نطاق اختياري: ?from=ISO&to=ISO — to حصري.
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  if (fromParam || toParam) {
    const from = new Date(fromParam ?? "");
    const to = new Date(toParam ?? "");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "نطاق التاريخ غير صالح" },
        { status: 400 },
      );
    }
    const expenses = await listExpenses(ctx, { from, to });
    return NextResponse.json({ expenses }, { status: 200 });
  }

  const expenses = await listExpenses(ctx);
  return NextResponse.json({ expenses }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req);
  if (ctx === "LOCKED") {
    return NextResponse.json(
      { error: "التطبيق مقفل — أدخل الرمز الرقمي للفتح" },
      { status: 423 },
    );
  }
  if (!ctx) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = parseCreateExpense(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const expense = await createExpense(ctx, parsed.value);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    console.error("[expenses:create] failed:", err);
    return NextResponse.json({ error: "تعذر إنشاء المصروف" }, { status: 500 });
  }
}
