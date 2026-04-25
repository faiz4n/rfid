export function normalizeUID(uid = "") {
  const hex = String(uid).replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  return hex.match(/.{1,2}/g)?.join(" ") || "";
}
