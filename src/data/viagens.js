import { db } from "../lib/supabase";

export async function getSemanasViagens(caminhaoId) {
  return db.select(
    "viagens_semanas",
    `caminhao_id=eq.${caminhaoId}&select=*&order=inicio.desc`
  );
}

export async function criarSemanaViagens(caminhaoId, inicio, fim) {
  const [semana] = await db.insert("viagens_semanas", {
    caminhao_id: caminhaoId,
    inicio,
    fim,
    viagens: [],
  });

  return semana;
}

export async function adicionarViagem(semana, viagem) {
  const novaViagem = { id: Date.now(), ...viagem };
  const viagensAtualizadas = [...semana.viagens, novaViagem];

  const [semanaAtualizada] = await db.update(
    "viagens_semanas",
    `id=eq.${semana.id}`,
    { viagens: viagensAtualizadas }
  );

  return semanaAtualizada;
}

export async function excluirViagem(semana, idViagem) {
  const viagensAtualizadas = semana.viagens.filter(
    (viagem) => viagem.id !== idViagem
  );

  const [semanaAtualizada] = await db.update(
    "viagens_semanas",
    `id=eq.${semana.id}`,
    { viagens: viagensAtualizadas }
  );

  return semanaAtualizada;
}

export async function excluirSemanaViagens(idSemana) {
  await db.remove("viagens_semanas", `id=eq.${idSemana}`);
}
