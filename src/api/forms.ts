import { makeClient } from "./client";
export type FormTree = { id_formulario: string; nombre: string };

export async function getFormsTree(): Promise<FormTree[]> {
  const api = await makeClient();
  const { data } = await api.get<FormTree[]>("/forms/tree");
  console.log(data);
  return data ?? [];
}
