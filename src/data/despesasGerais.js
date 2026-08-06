import { db } from "../lib/supabase";

export async function getDespesasGerais() {
  return db.select("despesas_gerais", "select=*&order=data.desc");
}

export async function criarDespesaGeral({ data, descricao, valor }) {
  const [despesa] = await db.insert("despesas_gerais", {
    data,
    descricao,
    valor: Number(valor),
  });

  return despesa;
}

export async function excluirDespesaGeral(id) {
  await db.remove("despesas_gerais", `id=eq.${id}`);
}
