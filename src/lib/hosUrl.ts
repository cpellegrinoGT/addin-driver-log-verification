export function buildHosLogsUrl(driverId: string, startDate: string, endDate: string): string {
  const path = window.location.pathname.replace(/\/+$/, "");
  const base = window.location.origin + path;
  return base + "#hosLogs," +
    "dateRange:(endDate:'" + endDate + "',startDate:'" + startDate + "')," +
    "driver:" + driverId + "," +
    "includeExemptions:!f,includeIntermediateLogs:!f,includeModificationOption:!t";
}
