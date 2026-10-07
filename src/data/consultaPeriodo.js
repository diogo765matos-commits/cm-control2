import { db } from "../lib/supabase";
import { converterNumero } from "../utils/formatadores";
import { taxaEfetivaViagem } from "./caminhoes";

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
    viagens: viagensComValores,
    abastecimentos,
    despesasCaminhao,
    despesasGerais,
    icms,
    totais: {
      quantidadeViagens: viagensComValores.length,
      volumeEntregue: viagensComValores.reduce((soma, item) => soma + item.volumeEntregue, 0),
      receitaBruta: viagensComValores.reduce((soma, item) => soma + item.valorEntregue, 0),
      combustivel: abastecimentos.reduce((soma, item) => soma + (Number(item.valorTotal) || 0), 0),
      despesasCaminhao: despesasCaminhao.reduce((soma, item) => soma + (Number(item.valor) || 0), 0),
      despesasGerais: despesasGerais.reduce((soma, item) => soma + (Number(item.valor) || 0), 0),
      icms: icms.reduce((soma, item) => soma + (Number(item.valor) || 0), 0),
    },
  };
}
