import { getServerT, tMaybe } from "@/lib/i18n";
import { NextRequest, NextResponse } from "next/server";
import { requireGate } from "@/lib/tenant/require-tenant";
import {
  createPatient,
  listPatients,
  parseCreatePatient,
} from "@/lib/services/patients";

export async function GET(req: NextRequest) {
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  const search = req.nextUrl.searchParams.get("q") ?? undefined;
  const patients = await listPatients(ctx, search || undefined);
  return NextResponse.json({ patients }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const t = await getServerT();
  const gate = await requireGate(req);
  if (!gate.ok) return gate.response;
  const ctx = gate.ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("api.invalidRequest") }, { status: 400 });
  }

  const parsed = parseCreatePatient(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: tMaybe(t, parsed.error) }, { status: 400 });
  }

  try {
    const patient = await createPatient(ctx, parsed.value);
    return NextResponse.json({ patient }, { status: 201 });
  } catch (err) {
    console.error("[patients:create] failed:", err);
    return NextResponse.json({ error: t("api.patientCreateFailed") }, { status: 500 });
  }
}
