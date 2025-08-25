// src/types.ts
export type AuthUser = {
  nombre: string;
  nombre_de_usuario: string;
  roles: { id: string; nombre: string }[];
};

export type JwtTokens = { accessToken: string; refreshToken?: string };

export type FormField = {
  id: string;
  sequence: number;
  tipo: string; // texto, numerico, etc.
  clase: string; // boolean, number, list, etc.
  nombre_interno: string;
  etiqueta: string | null;
  ayuda: string | null;
  config: any | null;
  requerido: number | boolean;
};

export type FormPage = {
  id: string;
  secuencia: number | null;
  nombre: string;
  descripcion: string | null;
  version_id: string;
  version_fecha: string; // ISO
  campos: FormField[];
};

export type FormTree = {
  id_formulario: string;
  nombre: string;
  version_vigente: { id_index_version: string; fecha_creacion: string };
  paginas: FormPage[];
};
