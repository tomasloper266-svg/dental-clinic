export function WelcomeCard({ clinicName }: { clinicName: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xl font-semibold">مرحباً بك في {clinicName}</p>
      <p className="mt-2 text-sm text-neutral-500">
        لوحة الطبيب الرئيسية ستُبنى في المراحل القادمة.
      </p>
    </div>
  );
}
