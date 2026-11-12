import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import InventoryBoard from "@/components/InventoryBoard";
import LogoutButton from "@/components/LogoutButton";

// صفحة المخزون — مواد العيادة، التوريد، الخصم، وتنبيه النقص.
export default async function InventoryPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-teal-800">مخزون العيادة</h1>
          <div className="flex items-center gap-3 text-xs">
            <a href="/dashboard" className="text-teal-700 underline">
              اللوحة
            </a>
            <LogoutButton />
          </div>
        </header>
        <InventoryBoard />
      </div>
    </main>
  );
}
