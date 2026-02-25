export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "--";
  const dt = new Date(d);
  return (dt.getMonth() + 1) + "/" + dt.getDate() + "/" + dt.getFullYear();
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "--";
  return n.toFixed(1) + "%";
}

export function isVerified(log: { verifyDateTime?: string | Date | null }): boolean {
  if (!log.verifyDateTime) return false;
  const vdt = log.verifyDateTime;
  if (typeof vdt === "string" && vdt.indexOf("0001-01-01") === 0) return false;
  if (vdt instanceof Date && vdt.getFullYear() <= 1) return false;
  return true;
}
