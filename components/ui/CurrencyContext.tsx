"use client";

import { createContext, useContext, useCallback } from "react";
import { formatPrimaryFromUsd } from "@/lib/currency";
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

/** سعر صرف الدولار من سياق إعدادات العيادة — لمنسّقات التكلفة الدقيقة */
export function useUsdRate(): number {
  return useContext(MoneyContext).usdRate;
}

/**
 * مُنسِّق المبالغ المرتبط بسياق العملة وسعر صرف العيادة — يأخذ المبلغ المخزن
 * بالدولار ويُخرجه بالعملة المعروضة (الليرة تُشتق بالضرب في السعر): كل مبلغ
 * يعرضه المكون يمر عبر هنا فيستجيب فوراً لخيار USD/SYP وتحديثات السعر.
 */
export function useMoney(): (usd: number) => string {
  const { currency, usdRate } = useContext(MoneyContext);
  return useCallback(
    (usd: number) => formatPrimaryFromUsd(usd, usdRate, currency),
    [currency, usdRate],
  );
}
