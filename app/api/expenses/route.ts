import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  createExpense,
  listExpenses,
  parseCreateExpense,
} from "@/lib/services/expenses";

// سجل مصاريف العيادة — إنشاء وعرض. الفئات ثابتة: إيجار/رواتب/مواد/أخرى.

export async function GET(req: NextRequest) {
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  // نطاق اختياري: ?from=ISO&to=ISO — to حصري.
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  if (fromParam || toParam) {
    const from = new Date(fromParam ?? "");
    const to = new Date(toParam ?? "");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: t("api.invalidDateRange") },
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
  const t = await getRequestT(req);
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const parsed = parseCreateExpense(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const expense = await createExpense(ctx, parsed.value);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    console.error("[expenses:create] failed:", err);
    return NextResponse.json({ error: t("api.expenseCreateFailed") }, { status: 500 });
  }
}
