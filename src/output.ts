/** True when --json global flag is set */
export function isJsonMode(): boolean {
  return process.env.__SCR_JSON === "1";
}

export function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function table(
  rows: Record<string, unknown>[],
  columns?: string[]
): void {
  // In JSON mode emit raw array instead of ASCII table
  if (isJsonMode()) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log("(no results)");
    return;
  }

  const cols = columns ?? Object.keys(rows[0]);
  const widths = cols.map((col) =>
    Math.max(
      col.length,
      ...rows.map((r) => String(r[col] ?? "").length)
    )
  );

  const header = cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  const divider = widths.map((w) => "─".repeat(w)).join("──");

  console.log(header);
  console.log(divider);
  for (const row of rows) {
    const line = cols
      .map((c, i) => String(row[c] ?? "").padEnd(widths[i]))
      .join("  ");
    console.log(line);
  }
}

export function error(message: string): void {
  console.error(`error: ${message}`);
}
