// هيكل تحميل مجموعة التطبيق — سكيلتون بموضع الصفحة القياسي يطابق شكل
// الصفحات المحمّلة (ترويسة + شريط بطاقات) حتى لا يومض المحتوى أثناء القراءة.
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="bg-warm-100 h-8 w-48 animate-pulse rounded-md" />
        <div className="bg-warm-100 h-4 w-64 animate-pulse rounded-md" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-panel bg-warm-100 h-24 animate-pulse"
          />
        ))}
      </div>
      <div className="rounded-panel bg-warm-100 mt-4 h-64 animate-pulse" />
    </div>
  );
}
