"use client";

import { createContext, useContext } from "react";
import type { DisplayCurrency } from "@/lib/currency";

// سياق العملة المعروضة — قيمته من إعدادات العيادة يزوّده الغلاف المشترك
// (AppShell)، والافتراض USD حتى تبقى الشاشات القائمة على حالها دون تمرير.

const CurrencyContext = createContext<DisplayCurrency>("USD");

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: DisplayCurrency;
  children: React.ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency}>
      {children}
    </CurrencyContext.Provider>
  );
}

/** العملة المعروضة الحالية — تعمل داخل مكونات العملاء فقط */
export function useDisplayCurrency(): DisplayCurrency {
  return useContext(CurrencyContext);
}
