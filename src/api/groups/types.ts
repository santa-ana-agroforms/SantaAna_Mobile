export type GroupField = {
  id_campo: string;
  sequence: number;
  tipo: string;
  clase: string;
  nombre_interno: string;
  etiqueta: string | null;
  ayuda: string | null;
  config: unknown | null;
  requerido: boolean;

  // contexto mínimo de página (para ordenar/mostrar)
  pagina: {
    id_pagina: string;
    nombre: string;
    secuencia: number | null;
  };
};

export type GroupTree = {
  id_grupo: string;
  nombre: string;
  campos: GroupField[];
};
