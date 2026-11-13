import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import StaffBoard from "@/components/staff/StaffBoard";

// صفحة الطاقم — أعضاء فريق العيادة وإدارتهم، محمية بالجلسة.
export default async function StaffPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <div className={pageWrapClass("full")}>
      <StaffBoard />
    </div>
  );
}
