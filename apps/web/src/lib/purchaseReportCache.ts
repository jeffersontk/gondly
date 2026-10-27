import type { QueryClient } from "@tanstack/react-query";

const reportKeys = ["dashboard", "insights", "purchases", "price-comparison-mine", "price-comparison-insights", "product-price-details", "price-hint"];

export function configurePurchaseReportQueries(client: QueryClient) {
  for (const key of reportKeys) {
    client.setQueryDefaults([key], {
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    });
  }
}

export function invalidatePurchaseReports(client: QueryClient) {
  return Promise.all(reportKeys.map(key => client.invalidateQueries({ queryKey: [key] })));
}
