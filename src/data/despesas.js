import { db } from "../lib/supabase";

export async function getSemanasDespesas(caminhaoId) {
  return db.select(
    "despesas_semanas",
    `caminhao_id=eq.${caminhaoId}&select=*&order=inicio.desc`
  );
}

export async function criarSemanaDespesas(caminhaoId, inicio, fim) {
  const [semana] = await db.insert("despesas_semanas", {
    caminhao_id: caminhaoId,
    inicio,
    fim,
    despesas: [],
  });

  return semana;
}

export async function adicionarDespesa(semana, despesa) {
  const novaDespesa = { id: Date.now(), ...despesa };
  const despesasAtualizadas = [...semana.despesas, novaDespesa];

  const [semanaAtualizada] = await db.update(
    "despesas_semanas",
    `id=eq.${semana.id}`,
    { despesas: despesasAtualizadas }
  );

  return semanaAtualizada;
}

export async function excluirDespesa(semana, idDespesa) {
  const despesasAtualizadas = semana.despesas.filter(
    (despesa) => despesa.id !== idDespesa
  );

  const [semanaAtualizada] = await db.update(
    "despesas_semanas",
    `id=eq.${semana.id}`,
    { despesas: despesasAtualizadas }
  );

  return semanaAtualizada;
}

export async function excluirSemanaDespesas(idSemana) {
  await db.remove("despesas_semanas", `id=eq.${idSemana}`);
}
