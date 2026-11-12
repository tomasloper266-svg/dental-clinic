import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  destroySession,
  sessionCookieOptions,
} from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  await destroySession(token);

  const res = NextResponse.json({ ok: true }, { status: 200 });
  // كوكي منتهٍ فوراً لإزالته من المتصفح.
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
  return res;
}
