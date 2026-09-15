// Agrupa viagens, abastecimentos e despesas (de um caminhão ou de todos)
// pelo período (início/fim) da semana, calculando os totais financeiros de
// cada período. Usado no Painel (todos os caminhões) e na página de um
// caminhão específico (só as semanas dele).

import { PERCENTUAL_MOTORISTA } from "../data/config";
import { taxaEfetivaViagem } from "../data/caminhoes";
import { converterNumero } from "./formatadores";

// A taxa por unidade entregue varia por frota (ex: Bagaço de Cana usa
// tonelada a R$290, as demais usam volume a VALOR_POR_VOLUME) — e cada
// viagem usa a taxa que estava em vigor quando ela foi lançada (ver
// taxaEfetivaViagem em data/caminhoes.js), não a taxa atual, pra viagens
// antigas não mudarem de valor quando o preço é reajustado. Quem chama
// esta função pode informar `frotaPorCaminhao` (Map caminhao_id -> frota)
// quando está somando semanas de vários caminhões/frotas ao mesmo tempo,
// ou `frotaPadrao` quando já sabe a frota (ex: um único caminhão).
function frotaDaSemana(semana, frotaPorCaminhao, frotaPadrao) {
  if (frotaPorCaminhao && frotaPorCaminhao.has(semana.caminhao_id)) {
    return frotaPorCaminhao.get(semana.caminhao_id);
  }

  return frotaPadrao;
}

export function chavePeriodo(inicio, fim) {
  return `${inicio}_${fim}`;
}

function dentroDoFiltro(data, inicioFiltro, fimFiltro) {
  if (inicioFiltro && data < inicioFiltro) return false;
  if (fimFiltro && data > fimFiltro) return false;
  return true;
}

export function calcularResumoPorPeriodo(
  semanasViagens,
  semanasAbastecimento,
  semanasDespesas,
  { inicioFiltro, fimFiltro, frotaPorCaminhao, frotaPadrao } = {}
) {
  const periodos = new Map();

  function pegarPeriodo(inicio, fim) {
    const chave = chavePeriodo(inicio, fim);

    if (!periodos.has(chave)) {
      periodos.set(chave, {
        inicio,
        fim,
        totalViagens: 0,
        volumeEntregue: 0,
        receitaBruta: 0,
        totalCombustivel: 0,
        totalDespesasExtras: 0,
      });
    }

    return periodos.get(chave);
  }

  (semanasViagens || [])
    .filter((semana) => dentroDoFiltro(semana.inicio, inicioFiltro, fimFiltro))
    .forEach((semana) => {
      const periodo = pegarPeriodo(semana.inicio, semana.fim);
      periodo.totalViagens += semana.viagens.length;

      const frota = frotaDaSemana(semana, frotaPorCaminhao, frotaPadrao);

      semana.viagens.forEach((viagem) => {
        const volEntregue = converterNumero(viagem.volEntregue) || 0;
        const taxa = taxaEfetivaViagem(viagem, frota);
        periodo.volumeEntregue += volEntregue;
        periodo.receitaBruta += volEntregue * taxa;
      });
    });

  (semanasAbastecimento || [])
    .filter((semana) => dentroDoFiltro(semana.inicio, inicioFiltro, fimFiltro))
    .forEach((semana) => {
      const periodo = pegarPeriodo(semana.inicio, semana.fim);

      semana.abastecimentos.forEach((abastecimento) => {
        periodo.totalCombustivel += abastecimento.valorTotal || 0;
      });
    });

  (semanasDespesas || [])
    .filter((semana) => dentroDoFiltro(semana.inicio, inicioFiltro, fimFiltro))
    .forEach((semana) => {
      const periodo = pegarPeriodo(semana.inicio, semana.fim);

      semana.despesas.forEach((despesa) => {
        periodo.totalDespesasExtras += Number(despesa.valor) || 0;
      });
    });

  return Array.from(periodos.values())
    .map((periodo) => {
      const pagamentoMotoristas = periodo.receitaBruta * PERCENTUAL_MOTORISTA;
      const gastos =
        periodo.totalCombustivel +
        periodo.totalDespesasExtras +
        pagamentoMotoristas;
      const lucro = periodo.receitaBruta - gastos;

      return {
        ...periodo,
        pagamentoMotoristas,
        gastos,
        lucro,
      };
    })
    .sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
}

export function somarPeriodos(periodos) {
  return periodos.reduce(
    (soma, periodo) => ({
      totalViagens: soma.totalViagens + periodo.totalViagens,
      volumeEntregue: soma.volumeEntregue + periodo.volumeEntregue,
      receitaBruta: soma.receitaBruta + periodo.receitaBruta,
      totalCombustivel: soma.totalCombustivel + periodo.totalCombustivel,
      totalDespesasExtras:
        soma.totalDespesasExtras + periodo.totalDespesasExtras,
      pagamentoMotoristas:
        soma.pagamentoMotoristas + periodo.pagamentoMotoristas,
      lucro: soma.lucro + periodo.lucro,
    }),
    {
      totalViagens: 0,
      volumeEntregue: 0,
      receitaBruta: 0,
      totalCombustivel: 0,
      totalDespesasExtras: 0,
      pagamentoMotoristas: 0,
      lucro: 0,
    }
  );
}
