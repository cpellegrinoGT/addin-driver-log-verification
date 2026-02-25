export function exportCsv(
  filename: string,
  headers: string[],
  rows: Record<string, unknown>[],
): void {
  const lines = [headers.join(",")];

  for (const r of rows) {
    const vals = headers.map((h) => {
      let v = r[h] != null ? String(r[h]) : "";
      if (v.indexOf(",") >= 0 || v.indexOf('"') >= 0 || v.indexOf("\n") >= 0) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    });
    lines.push(vals.join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
