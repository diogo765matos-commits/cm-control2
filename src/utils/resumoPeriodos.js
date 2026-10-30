// Agrupa viagens, abastecimentos e despesas (de um caminhão ou de todos)
// pelo período (início/fim) da semana, calculando os totais financeiros de
// cada período. Usado no Painel (todos os caminhões) e na página de um
// caminhão específico (só as semanas dele).

import { repartirReceita, custoDaEmpresa, fecharReceitas } from "./receitaEmpresa";
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
  if (frotaPorCaminhao) {
    for (const [id, frota] of frotaPorCaminhao) {
      if (String(id) === String(semana.caminhao_id)) return frota;
    }
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
        ...repartirReceita(0, null),
        totalCombustivel: 0,
        totalDespesasExtras: 0,
        custosNaoClassificados: 0,
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
        const receita = repartirReceita(volEntregue * taxa, frota);
        Object.keys(receita).forEach((campo) => { periodo[campo] += receita[campo]; });
      });
    });

  (semanasAbastecimento || [])
    .filter((semana) => dentroDoFiltro(semana.inicio, inicioFiltro, fimFiltro))
    .forEach((semana) => {
      const frota = frotaDaSemana(semana, frotaPorCaminhao, frotaPadrao);
      const periodo = pegarPeriodo(semana.inicio, semana.fim);

      semana.abastecimentos.forEach((abastecimento) => {
        const valor = Number(abastecimento.valorTotal) || 0;
        if (custoDaEmpresa(frota)) periodo.totalCombustivel += valor;
        else if (frota !== "terceirizada") periodo.custosNaoClassificados += valor;
      });
    });

  (semanasDespesas || [])
    .filter((semana) => dentroDoFiltro(semana.inicio, inicioFiltro, fimFiltro))
    .forEach((semana) => {
      const frota = frotaDaSemana(semana, frotaPorCaminhao, frotaPadrao);
      const periodo = pegarPeriodo(semana.inicio, semana.fim);

      semana.despesas.forEach((despesa) => {
        const valor = Number(despesa.valor) || 0;
        if (custoDaEmpresa(frota)) periodo.totalDespesasExtras += valor;
        else if (frota !== "terceirizada") periodo.custosNaoClassificados += valor;
      });
    });

  return Array.from(periodos.values())
    .map((brutoPeriodo) => {
      const periodo = fecharReceitas(brutoPeriodo);
      const pagamentoMotoristas = periodo.pagamentoMotoristas;
      const gastos =
        periodo.totalCombustivel +
        periodo.totalDespesasExtras +
        pagamentoMotoristas;
      const lucro = periodo.receitaEmpresa - gastos;

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
  const soma = periodos.reduce(
    (soma, periodo) => ({
      totalViagens: soma.totalViagens + periodo.totalViagens,
      volumeEntregue: soma.volumeEntregue + periodo.volumeEntregue,
      ...Object.fromEntries(Object.keys(repartirReceita(0, null)).map((campo) => [campo, soma[campo] + periodo[campo]])),
      totalCombustivel: soma.totalCombustivel + periodo.totalCombustivel,
      custosNaoClassificados: soma.custosNaoClassificados + periodo.custosNaoClassificados,
      totalDespesasExtras:
        soma.totalDespesasExtras + periodo.totalDespesasExtras,
      pagamentoMotoristas:
        soma.pagamentoMotoristas + periodo.pagamentoMotoristas,
      lucro: soma.lucro + periodo.lucro,
    }),
    {
      totalViagens: 0,
      volumeEntregue: 0,
      ...repartirReceita(0, null),
      totalCombustivel: 0,
      totalDespesasExtras: 0,
      custosNaoClassificados: 0,
      pagamentoMotoristas: 0,
      lucro: 0,
    }
  );
  const fechado = fecharReceitas(soma);
  return { ...fechado, lucro: fechado.receitaEmpresa - fechado.pagamentoMotoristas - fechado.totalCombustivel - fechado.totalDespesasExtras };
}
