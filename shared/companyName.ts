/**
 * Display-only company names. Strips a trailing legal suffix so long names
 * ("Seagate Technology Holdings plc") fit on cards and table headers. The
 * stored name is never changed; this is for rendering only.
 */
const SUFFIXES = [
  ", Inc.", " Inc.", ", Inc", " Inc",
  " Corporation", " Corp.", " Corp",
  " plc", " PLC", " Holdings",
  " Ltd.", " Ltd", " Limited",
  " N.V.", " S.A.", " & Co.",
];

export function displayCompanyName(name: string): string {
  const original = (name ?? "").trim();
  let out = original;
  // Repeat so combinations ("... Holdings plc", "... Holdings, Inc.") fully strip.
  for (let guard = 0; guard < 4; guard++) {
    const hit = SUFFIXES.find((s) => out.endsWith(s) && out.length > s.length);
    if (!hit) break;
    out = out.slice(0, -hit.length).replace(/[,\s]+$/, "");
  }
  return out || original;
}
