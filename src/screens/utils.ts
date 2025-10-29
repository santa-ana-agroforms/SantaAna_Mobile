// Strings en Redux  ⇄  Date en la UI

export const toDateOnly = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const toTimeOnly = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// "YYYY-MM-DD" -> Date (00:00)
export const parseDateOnly = (s?: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
};

// "HH:mm" -> Date (usa hoy con esa hora/min)
export const parseTimeOnly = (s?: string | null): Date | null => {
  if (!s) return null;
  const [H, M] = s.split(":").map(Number);
  const dt = new Date();
  dt.setSeconds(0, 0);
  dt.setHours(H ?? 0, M ?? 0);
  return isNaN(dt.getTime()) ? null : dt;
};
