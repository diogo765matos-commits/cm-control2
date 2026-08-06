import { db } from "../lib/supabase";

export async function getSemanasAbastecimento(caminhaoId) {
  return db.select(
    "abastecimento_semanas",
    `caminhao_id=eq.${caminhaoId}&select=*&order=inicio.desc`
  );
}

export async function criarSemanaAbastecimento(caminhaoId, inicio, fim) {
  const [semana] = await db.insert("abastecimento_semanas", {
    caminhao_id: caminhaoId,
    inicio,
    fim,
    abastecimentos: [],
  });

  return semana;
}

export async function adicionarAbastecimento(semana, abastecimento) {
  const novoAbastecimento = { id: Date.now(), ...abastecimento };
  const abastecimentosAtualizados = [
    ...semana.abastecimentos,
    novoAbastecimento,
  ];

  const [semanaAtualizada] = await db.update(
    "abastecimento_semanas",
    `id=eq.${semana.id}`,
    { abastecimentos: abastecimentosAtualizados }
  );

  return semanaAtualizada;
}

export async function excluirAbastecimento(semana, idAbastecimento) {
  const abastecimentosAtualizados = semana.abastecimentos.filter(
    (abastecimento) => abastecimento.id !== idAbastecimento
  );

  const [semanaAtualizada] = await db.update(
    "abastecimento_semanas",
    `id=eq.${semana.id}`,
    { abastecimentos: abastecimentosAtualizados }
  );

  return semanaAtualizada;
}

export async function excluirSemanaAbastecimento(idSemana) {
  await db.remove("abastecimento_semanas", `id=eq.${idSemana}`);
}
