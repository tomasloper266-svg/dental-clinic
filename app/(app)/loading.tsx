// هيكل تحميل مجموعة التطبيق — سكيلتون بموضع الصفحة القياسي يطابق شكل
// الصفحات المحمّلة (ترويسة + شريط بطاقات) حتى لا يومض المحتوى أثناء القراءة.
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-warm-100" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-warm-100" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-panel bg-warm-100"
          />
        ))}
      </div>
      <div className="mt-4 h-64 animate-pulse rounded-panel bg-warm-100" />
    </div>
  );
}
