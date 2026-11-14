"use client";

import { createContext, useContext, useCallback } from "react";
import { formatPrimaryFromSyp } from "@/lib/currency";
import type { DisplayCurrency } from "@/lib/currency";

// سياق عرض المبالغ — العملة المعروضة وسعر صرف العيادة معاً من إعدادات
// العيادة يزوّدهما الغلاف المشترك (layout → AppShell)، والافتراض USD
// بسعر النمط حتى تبقى الشاشات القائمة على حالها دون تمرير.

type MoneyContextValue = {
  currency: DisplayCurrency;
  usdRate: number;
};

const MoneyContext = createContext<MoneyContextValue>({
  currency: "USD",
  usdRate: 15000,
});

export function CurrencyProvider({
  currency,
  usdRate,
  children,
}: MoneyContextValue & { children: React.ReactNode }) {
  return (
    <MoneyContext.Provider value={{ currency, usdRate }}>
      {children}
    </MoneyContext.Provider>
  );
}

/** العملة المعروضة الحالية — تعمل داخل مكونات العملاء فقط */
export function useDisplayCurrency(): DisplayCurrency {
  return useContext(MoneyContext).currency;
}

/**
 * مُنسِّق المبالغ المرتبط بسياق العملة وسعر صرف العيادة — البديل الموحّد
 * لـ formatSyp وsypToUsd المبعثرين: كل مبلغ يعرضه المكون يمر عبر هنا
 * فيستجيب فوراً لخيار USD/SYP وسعر الصرف من الإعدادات.
 */
export function useMoney(): (syp: number) => string {
  const { currency, usdRate } = useContext(MoneyContext);
  return useCallback(
    (syp: number) => formatPrimaryFromSyp(syp, usdRate, currency),
    [currency, usdRate],
  );
}
