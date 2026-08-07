import { db } from "../lib/supabase";

export async function getSemanasDespesasGerais() {
  return db.select(
    "despesas_gerais_semanas",
    "select=*&order=inicio.desc"
  );
}

export async function criarSemanaDespesasGerais(inicio, fim) {
  const [semana] = await db.insert("despesas_gerais_semanas", {
    inicio,
    fim,
    despesas: [],
  });

  return semana;
}

export async function adicionarDespesaGeral(semana, despesa) {
  const novaDespesa = { id: Date.now(), ...despesa };
  const despesasAtualizadas = [...semana.despesas, novaDespesa];

  const [semanaAtualizada] = await db.update(
    "despesas_gerais_semanas",
    `id=eq.${semana.id}`,
    { despesas: despesasAtualizadas }
  );

  return semanaAtualizada;
}

export async function excluirDespesaGeral(semana, idDespesa) {
  const despesasAtualizadas = semana.despesas.filter(
    (despesa) => despesa.id !== idDespesa
  );

  const [semanaAtualizada] = await db.update(
    "despesas_gerais_semanas",
    `id=eq.${semana.id}`,
    { despesas: despesasAtualizadas }
  );

  return semanaAtualizada;
}

export async function excluirSemanaDespesasGerais(idSemana) {
  await db.remove("despesas_gerais_semanas", `id=eq.${idSemana}`);
}
