export function localHistoryDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function historyPeriodBounds(startDate: string, endDate: string) {
  return {
    startDate: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : "",
    endDate: endDate ? new Date(`${endDate}T23:59:59.999`).toISOString() : "",
  };
}
