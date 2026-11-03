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
    filtroSemanaOriginal(semana),
    { viagens: viagensAtualizadas }
  );

  if (!semanaAtualizada) throw new Error("Esta semana foi alterada em outra sessão. Reabra a semana e confira os dados antes de tentar novamente.");
  return semanaAtualizada;
}

export async function excluirViagem(semana, idViagem) {
  const viagensAtualizadas = semana.viagens.filter(
    (viagem) => viagem.id !== idViagem
  );

  const [semanaAtualizada] = await db.update(
    "viagens_semanas",
    filtroSemanaOriginal(semana),
    { viagens: viagensAtualizadas }
  );

  if (!semanaAtualizada) throw new Error("Esta semana foi alterada em outra sessão. Reabra a semana e confira os dados antes de tentar novamente.");
  return semanaAtualizada;
}

export async function excluirSemanaViagens(idSemana) {
  await db.remove("viagens_semanas", `id=eq.${idSemana}`);
}

export async function atualizarSemanaViagens(idSemana, dados) {
  const [semana] = await db.update(
    "viagens_semanas",
    `id=eq.${idSemana}`,
    dados
  );

  return semana;
}

// Compare-and-swap: uma escrita só ocorre se o JSON e o período continuam
// iguais ao que foi lido. Impede perder inclusões/edições de outra sessão.
function filtroSemanaOriginal(semana) {
  const query = new URLSearchParams({
    id: `eq.${semana.id}`,
    viagens: `eq.${JSON.stringify(semana.viagens)}`,
    inicio: `eq.${semana.inicio}`,
    fim: `eq.${semana.fim}`,
  });
  return query.toString();
}

export async function editarViagem(semana, original, dados) {
  const indice = semana.viagens.findIndex(v => v.id === original.id);
  if (indice < 0) throw new Error("Viagem não encontrada nesta semana.");
  const alteracoes = {};
  const campos = ["data", "nf", "cte", "volFiscal", "volEntregue", "dataEntrega", "taxa"];
  for (const campo of campos) {
    if (dados[campo] === original[campo]) continue;
    let valor = dados[campo];
    // Entrega e volume fiscal são opcionais no cadastro original.
    if ((campo === "dataEntrega" || campo === "volFiscal") && valor === "") {
      alteracoes[campo] = valor;
      continue;
    }
    if (["data", "dataEntrega"].includes(campo)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(Date.parse(valor)) ||
          new Date(valor).toISOString().slice(0, 10) !== valor) {
        throw new Error("Informe uma data válida.");
      }
      if (valor < semana.inicio || valor > semana.fim) {
        throw new Error("A data deve permanecer dentro desta semana. Nenhuma viagem será movida automaticamente.");
      }
    }
    if (["volFiscal", "volEntregue", "taxa"].includes(campo)) {
      if (valor === "" || valor == null) throw new Error("Preencha os volumes e o valor por unidade alterados.");
      valor = Number(String(valor).replace(",", "."));
      if (!Number.isFinite(valor) || valor < 0 || (campo === "taxa" && valor === 0)) {
        throw new Error("Use volumes não negativos e um valor por unidade maior que zero.");
      }
    }
    alteracoes[campo] = valor;
  }
  if (!Object.keys(alteracoes).length) return null;
  const viagens = semana.viagens.map((v, i) => i === indice ? { ...v, ...alteracoes } : v);
  const [atualizada] = await db.update("viagens_semanas", filtroSemanaOriginal(semana), { viagens });
  if (!atualizada) throw new Error("Esta semana foi alterada em outra sessão. Cancele, reabra o caminhão e confira os dados antes de tentar novamente.");
  return atualizada;
}
