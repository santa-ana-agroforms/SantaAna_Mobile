// Define qué espera y cómo valida/normaliza cada campo según (tipo, clase)
export type FieldKey =
  | "texto:string"
  | "texto:list"
  | "texto:date"
  | "numerico:number"
  | "numerico:calc"
  | "texto:calc"
  | "calc:calc"
  | "booleano:boolean"
  | "imagen:firm"
  | "grupo:group"
  | "texto:hour"
  | "texto:dataset";

export type FieldConfig = Record<string, unknown>; // libre según backend
export type Normalizer = (value: unknown, config?: FieldConfig) => any;
export type Validator = (value: unknown, requerido: boolean, config?: FieldConfig) => string[]; // errores

const isEmpty = (v: any) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

const normalizeString: Normalizer = (v) => (v == null ? "" : String(v));
const validateString: Validator = (v, req) => (req && isEmpty(v) ? ["Requerido"] : []);

const normalizeList: Normalizer = (v) => v; // tu UI decidirá si es single o multi; aquí lo dejamos libre
const validateList: Validator = (v, req, cfg) => {
  if (req && isEmpty(v)) return ["Requerido"];
  // Opcional: si cfg.items existe, validar pertenencia
  const items = Array.isArray(cfg?.items) ? (cfg!.items as any[]) : undefined;
  if (items && v != null) {
    const ok = Array.isArray(v) ? v.every((x) => items.includes(x)) : items.includes(v);
    if (!ok) return ["Valor no permitido"];
  }
  return [];
};

const normalizeDate: Normalizer = (v) => {
  if (!v) return "";
  // aceptar Date o ISO string; guardar ISO local (sin Z) para consistencia local
  const d = v instanceof Date ? v : new Date(String(v));
  if (isNaN(d.getTime())) return "";
  // YYYY-MM-DD
  const iso = d.toISOString();
  return iso.slice(0, 10);
};
const validateDate: Validator = (v, req) => (req && isEmpty(v) ? ["Requerido"] : []);

const normalizeNumber: Normalizer = (v, cfg) => {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return null;
  // aplicar step opcional
  if (typeof (cfg as any)?.step === "number" && (cfg as any).step > 0) {
    const step = (cfg as any).step as number;
    return Math.round(n / step) * step;
  }
  return n;
};
const validateNumber: Validator = (v, req, cfg) => {
  const errs: string[] = [];
  if (req && (v === null || v === undefined)) errs.push("Requerido");
  if (v != null) {
    if (typeof v !== "number" || Number.isNaN(v)) errs.push("Debe ser numérico");
    const min = (cfg as any)?.min;
    const max = (cfg as any)?.max;
    if (typeof min === "number" && (v as number) < min) errs.push(`Mínimo ${min}`);
    if (typeof max === "number" && (v as number) > max) errs.push(`Máximo ${max}`);
  }
  return errs;
};

const normalizeBoolean: Normalizer = (v) => Boolean(v);
const validateBoolean: Validator = (v, req) => (req && typeof v !== "boolean" ? ["Requerido"] : []);

const normalizeFirm: Normalizer = (v) => (typeof v === "string" ? v : ""); // base64 string
const validateFirm: Validator = (v, req) => (req && isEmpty(v) ? ["Requerido"] : []);

// "calc" se calcula, no acepta entrada directa
const normalizeCalc: Normalizer = (v) => v;
const validateCalc: Validator = (_v, req) => (req ? [] : []);

// Grupo (repetible): es una lista de objetos { [nombreCampoInterno]: valor }
const normalizeGroup: Normalizer = (v) => (Array.isArray(v) ? v : []);
const validateGroup: Validator = (v, req) =>
  req && (!Array.isArray(v) || v.length === 0) ? ["Requerido"] : [];

export const emptyByField: Record<FieldKey, any> = {
  "texto:string": "",
  "texto:list": null, // o [] si multi; lo dejamos null hasta que UI defina
  "texto:date": "",
  "texto:hour": "",
  "numerico:number": null,
  "numerico:calc": null, // calculado (lo llena el motor)
  "booleano:boolean": false,
  "imagen:firm": "", // base64
  "grupo:group": [], // lista de objetos
  "texto:dataset": "",
  "calc:calc": null, // calculado
  "texto:calc": null, // calculado
};

export const normalizers: Record<FieldKey, Normalizer> = {
  "texto:string": normalizeString,
  "texto:list": normalizeList,
  "texto:date": normalizeDate,
  "numerico:number": normalizeNumber,
  "numerico:calc": normalizeCalc,
  "texto:calc": normalizeCalc,
  "calc:calc": normalizeCalc,
  "booleano:boolean": normalizeBoolean,
  "imagen:firm": normalizeFirm,
  "grupo:group": normalizeGroup,
  "texto:dataset": normalizeString,
  "texto:hour": normalizeString,
};

export const validators: Record<FieldKey, Validator> = {
  "texto:string": validateString,
  "texto:list": validateList,
  "texto:date": validateDate,
  "numerico:number": validateNumber,
  "numerico:calc": validateCalc,
  "texto:calc": validateCalc,
  "calc:calc": validateCalc,
  "booleano:boolean": validateBoolean,
  "imagen:firm": validateFirm,
  "grupo:group": validateGroup,
  "texto:dataset": validateString,
  "texto:hour": validateString,
};

export const keyOf = (tipo?: string, clase?: string): FieldKey | null => {
  const k = `${(tipo || "").toLowerCase()}:${(clase || "").toLowerCase()}`;
  const known = [
    "texto:string",
    "texto:list",
    "texto:date",
    "numerico:number",
    "numerico:calc",
    "texto:calc",
    "calc:calc",
    "booleano:boolean",
    "imagen:firm",
    "grupo:group",
    "texto:dataset",
    "texto:hour",
  ];
  return (known as string[]).includes(k) ? (k as FieldKey) : null;
};
