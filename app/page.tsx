import { WelcomeCard } from "@/components/WelcomeCard";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold sm:text-4xl">
        نظام إدارة عيادات الأسنان
      </h1>
      <p className="max-w-md text-lg text-neutral-600 dark:text-neutral-400">
        واجهة البداية — النسخة الأولى قيد التأسيس. الهيكل جاهز: مرضى، مواعيد،
        مخطط أسنان، حسابات ومخزون.
      </p>
      <WelcomeCard clinicName="عيادتك" />
    </main>
  );
}
