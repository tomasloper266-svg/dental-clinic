import { tMaybe, getRequestT } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  addToWaitlist,
  listWaitlist,
  parseCreateWaitlistEntry,
} from "@/lib/services/waitlist";

export async function GET(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;
  const entries = await listWaitlist(ctx);
  return NextResponse.json({ entries }, { status: 200 });
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

  const parsed = parseCreateWaitlistEntry(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  const result = await addToWaitlist(ctx, parsed.value);
  if (!result.ok) {
    return NextResponse.json({ error: tMaybe(t, result.error) }, { status: 400 });
  }
  return NextResponse.json({ entry: result.value }, { status: 201 });
}
