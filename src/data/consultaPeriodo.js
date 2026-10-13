import { db } from "../lib/supabase";
import { converterNumero } from "../utils/formatadores";
import { FROTA_BAGACO, FROTA_CM, FROTA_TERCEIRIZADA, taxaEfetivaViagem } from "./caminhoes";

export const ESCOPO_TODOS = "todos";
export const ESCOPO_FROTA_CM = "cm";
export const ESCOPO_FROTA_TERCEIRIZADA = "terceirizada";
export const ESCOPO_CAMINHAO = "caminhao";

const collatorNumero = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

function dentroDoIntervalo(data, inicio, fim) {
  return Boolean(data && data >= inicio && data <= fim);
}

function expandirSemanas(semanas, campoLista, tipo, inicio, fim, caminhoesPorId) {
  return (semanas || []).flatMap((semana) =>
    (semana[campoLista] || [])
      .filter((item) => dentroDoIntervalo(item.data, inicio, fim))
      .map((item) => {
        const caminhao = semana.caminhao_id
          ? caminhoesPorId.get(String(semana.caminhao_id)) || null
          : null;

        return {
          ...item,
          tipo,
          caminhaoId: semana.caminhao_id ?? null,
          caminhao,
          semana: { id: semana.id, inicio: semana.inicio, fim: semana.fim },
        };
      })
  );
}

function ordenarPorNumeroNF(a, b) {
  const nfA = String(a.nf ?? "").trim();
  const nfB = String(b.nf ?? "").trim();
  if (!nfA && nfB) return 1;
  if (nfA && !nfB) return -1;
  return collatorNumero.compare(nfA, nfB);
}

function idCaminhaoDoItem(item) {
  return item.caminhaoId ?? item.caminhao?.id ?? null;
}

function frotaDoItem(item, caminhoesPorId) {
  const id = idCaminhaoDoItem(item);
  return item.caminhao?.frota ?? caminhoesPorId.get(String(id))?.frota ?? null;
}

function itemPertenceAoEscopo(item, escopo, caminhaoId, caminhoesPorId) {
  if (escopo === ESCOPO_TODOS) return true;

  const id = idCaminhaoDoItem(item);
  if (escopo === ESCOPO_CAMINHAO) {
    return Boolean(caminhaoId) && String(id) === String(caminhaoId);
  }

  const frota = frotaDoItem(item, caminhoesPorId);
  if (escopo === ESCOPO_FROTA_CM) return frota === FROTA_CM || frota === FROTA_BAGACO;
  if (escopo === ESCOPO_FROTA_TERCEIRIZADA) return frota === FROTA_TERCEIRIZADA;
  return false;
}

function somar(itens, campo) {
  return itens.reduce((total, item) => total + (Number(item[campo]) || 0), 0);
}

/** Calcula valores de apresentação mantendo toneladas e m³ em medidas distintas. */
export function calcularTotaisConsulta(consulta) {
  const viagens = consulta.viagens || [];
  const caminhoesPorId = new Map(
    (consulta.caminhoes || []).map((caminhao) => [String(caminhao.id), caminhao])
  );
  const viagensBagaco = viagens.filter((viagem) => frotaDoItem(viagem, caminhoesPorId) === FROTA_BAGACO);
  const viagensVolume = viagens.filter((viagem) => [FROTA_CM, FROTA_TERCEIRIZADA].includes(frotaDoItem(viagem, caminhoesPorId)));
  const viagensUnidadeDesconhecida = viagens.filter((viagem) => ![FROTA_CM, FROTA_TERCEIRIZADA, FROTA_BAGACO].includes(frotaDoItem(viagem, caminhoesPorId)));
  const abastecimentos = consulta.abastecimentos || [];
  const despesasCaminhao = consulta.despesasCaminhao || [];
  const despesasGerais = consulta.despesasGerais || [];
  const icms = consulta.icms || [];

  return {
    quantidadeViagens: viagens.length,
    volumeEntregueM3: somar(viagensVolume, "volumeEntregue"),
    toneladasEntregues: somar(viagensBagaco, "volumeEntregue"),
    volumeUnidadeDesconhecida: somar(viagensUnidadeDesconhecida, "volumeEntregue"),
    receitaBruta: somar(viagens, "valorEntregue"),
    combustivel: somar(abastecimentos, "valorTotal"),
    despesasCaminhao: somar(despesasCaminhao, "valor"),
    despesasGerais: somar(despesasGerais, "valor"),
    icms: somar(icms, "valor"),
  };
}

/** Aplica o escopo ao resultado já consultado, sem iniciar uma nova busca. */
export function filtrarConsultaPorEscopo(consulta, escopo, caminhaoId = "") {
  if (!consulta) return null;

  const caminhoes = consulta.caminhoes || [];
  const caminhoesPorId = new Map(caminhoes.map((caminhao) => [String(caminhao.id), caminhao]));
  const filtrar = (itens = []) => itens.filter((item) => (
    itemPertenceAoEscopo(item, escopo, caminhaoId, caminhoesPorId)
  ));
  const caminhoesEscopo = escopo === ESCOPO_TODOS
    ? caminhoes
    : escopo === ESCOPO_CAMINHAO
      ? caminhoes.filter((caminhao) => String(caminhao.id) === String(caminhaoId))
      : caminhoes.filter((caminhao) => {
        if (escopo === ESCOPO_FROTA_CM) {
          return caminhao.frota === FROTA_CM || caminhao.frota === FROTA_BAGACO;
        }
        return caminhao.frota === FROTA_TERCEIRIZADA;
      });

  const filtrada = {
    ...consulta,
    caminhoes: caminhoesEscopo,
    viagens: filtrar(consulta.viagens),
    abastecimentos: filtrar(consulta.abastecimentos),
    despesasCaminhao: filtrar(consulta.despesasCaminhao),
    despesasGerais: escopo === ESCOPO_TODOS ? [...(consulta.despesasGerais || [])] : [],
    icms: filtrar(consulta.icms),
  };
  filtrada.totais = calcularTotaisConsulta(filtrada);
  return filtrada;
}

/**
 * Consulta os lançamentos pela data própria de cada item, mantendo o
 * fechamento semanal como metadado de origem. Viagens usam dataEntrega.
 */
export async function consultarLancamentosPorPeriodo(inicio, fim) {
  if (!inicio || !fim || inicio > fim) {
    throw new Error("Informe um intervalo válido: início anterior ou igual ao fim.");
  }

  const [caminhoes, semanasViagens, semanasAbastecimento, semanasDespesas,
    semanasDespesasGerais, registrosIcms] = await Promise.all([
    db.select("caminhoes", "select=id,modelo,placa,frota,motorista"),
    db.select("viagens_semanas", "select=id,caminhao_id,inicio,fim,viagens"),
    db.select("abastecimento_semanas", "select=id,caminhao_id,inicio,fim,abastecimentos"),
    db.select("despesas_semanas", "select=id,caminhao_id,inicio,fim,despesas"),
    db.select("despesas_gerais_semanas", "select=id,inicio,fim,despesas"),
    db.select("icms_registros", "select=*&order=data.asc"),
  ]);

  const caminhoesPorId = new Map(
    caminhoes.map((caminhao) => [String(caminhao.id), caminhao])
  );

  const viagens = semanasViagens.flatMap((semana) =>
    (semana.viagens || [])
      .filter((viagem) => dentroDoIntervalo(viagem.dataEntrega, inicio, fim))
      .map((viagem) => ({
        ...viagem,
        tipo: "viagem",
        data: viagem.dataEntrega,
        caminhaoId: semana.caminhao_id,
        caminhao: caminhoesPorId.get(String(semana.caminhao_id)) || null,
        semana: { id: semana.id, inicio: semana.inicio, fim: semana.fim },
      }))
  ).sort(ordenarPorNumeroNF);

  const abastecimentos = expandirSemanas(
    semanasAbastecimento, "abastecimentos", "abastecimento", inicio, fim, caminhoesPorId
  );
  const despesasCaminhao = expandirSemanas(
    semanasDespesas, "despesas", "despesa", inicio, fim, caminhoesPorId
  );
  const despesasGerais = expandirSemanas(
    semanasDespesasGerais, "despesas", "despesaGeral", inicio, fim, caminhoesPorId
  );
  const icms = registrosIcms
    .filter((registro) => dentroDoIntervalo(registro.data, inicio, fim))
    .map((registro) => ({
      ...registro,
      tipo: "icms",
      caminhaoId: registro.caminhao_id,
      caminhao: caminhoesPorId.get(String(registro.caminhao_id)) || null,
    }));

  const viagensComValores = viagens.map((viagem) => {
    const volumeFiscal = converterNumero(viagem.volFiscal) || 0;
    const volumeEntregue = converterNumero(viagem.volEntregue) || 0;
    const taxa = taxaEfetivaViagem(viagem, viagem.caminhao?.frota);
    return {
      ...viagem,
      volumeFiscal,
      volumeEntregue,
      taxa,
      valorFiscal: volumeFiscal * taxa,
      valorEntregue: volumeEntregue * taxa,
    };
  });

  return {
    inicio,
    fim,
    caminhoes,
    viagens: viagensComValores,
    abastecimentos,
    despesasCaminhao,
    despesasGerais,
    icms,
    totais: calcularTotaisConsulta({
      caminhoes,
      viagens: viagensComValores,
      abastecimentos,
      despesasCaminhao,
      despesasGerais,
      icms,
    }),
  };
}
