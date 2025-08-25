// ------- Tipos del árbol de formularios --------
export type FormField = {
  id_campo: string;
  sequence: number;
  tipo: string;
  clase: string;
  nombre_interno: string;
  etiqueta: string | null;
  ayuda: string | null;
  config: unknown | null;
  requerido: boolean;
};

export type FormPage = {
  id_pagina: string;
  secuencia: number | null;
  nombre: string;
  descripcion: string | null;
  pagina_version: { id: string; fecha_creacion: string }; // llega como ISO string
  campos: FormField[];
};

export type FormTree = {
  id_formulario: string;
  nombre: string;
  version_vigente: { id_index_version: string; fecha_creacion: string }; // ISO string
  paginas: FormPage[];
};

// ------- NUEVO: grupo por categoría --------
export type FormCategoryGroup = {
  nombre_categoria: string;
  descripcion: string | null;
  formularios: FormTree[];
};
