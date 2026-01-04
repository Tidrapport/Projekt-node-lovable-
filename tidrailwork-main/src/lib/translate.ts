export const translatePriority = (p?: string | null) => {
  const v = String(p || "").toLowerCase();
  if (v === "high" || v === "hög") return "Hög";
  if (v === "low" || v === "låg") return "Låg";
  if (v === "medium" || v === "med" || v === "m" || v === "medium") return "Medel";
  if (!p) return "Medel";
  // Fallback: capitalize first letter
  return String(p).charAt(0).toUpperCase() + String(p).slice(1);
};

export default translatePriority;
