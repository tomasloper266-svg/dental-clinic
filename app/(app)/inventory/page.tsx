import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import InventoryBoard from "@/components/inventory/InventoryBoard";

// صفحة المخزون — مواد العيادة وكمياتها وحدود تنبيهها، محمية بالجلسة
// والبيانات من واجهة برمجة العيادة حصراً.
export default async function InventoryPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <div className={pageWrapClass("full")}>
      <InventoryBoard />
    </div>
  );
}
