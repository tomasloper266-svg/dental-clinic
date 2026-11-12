import { cookies } from "next/headers";
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <InventoryBoard />
    </div>
  );
}
