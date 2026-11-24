import { PERCENTUAL_MOTORISTA } from '../data/config.js';

const PERCENTUAL_C_M_TERCEIRIZADA = 11;

/** Novos registros usam o contexto que foi salvo na viagem; os antigos, o do caminhão. */
export function frotaEfetivaViagem(viagem, frotaAtual) {
  return ['cm', 'terceirizada'].includes(viagem?.frotaRegistrada)
    ? viagem.frotaRegistrada
    : frotaAtual;
}

function percentualValidado(valor, padrao) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 100
    ? valor
    : padrao;
}

// Projeção somente de leitura: os percentuais vigentes hoje nunca são usados
// no fechamento de uma viagem salva. Repasse terceirizado é antes de encargos.
export function repartirReceita(bruto, frotaAtual, viagem) {
  const valor = Number(bruto) || 0;
  const frota = frotaEfetivaViagem(viagem, frotaAtual);
  const terceirizada = frota === 'terceirizada';
  const propria = frota === 'cm' || frota === 'bagaco';
  const percentMotorista = frota === 'cm'
    ? percentualValidado(viagem?.percentualAplicado, PERCENTUAL_MOTORISTA * 100)
    : PERCENTUAL_MOTORISTA * 100;
  const percentTerceirizada = percentualValidado(viagem?.percentualAplicado, PERCENTUAL_C_M_TERCEIRIZADA);
  const taxaMotoristaDiferente = Number(frota === 'cm' && percentMotorista !== PERCENTUAL_MOTORISTA * 100);
  const taxaTerceirizadaDiferente = Number(terceirizada && percentTerceirizada !== PERCENTUAL_C_M_TERCEIRIZADA);
  const comissaoCM = terceirizada ? valor * (percentTerceirizada / 100) : 0;
  return {
    receitaBruta: valor,
    brutoProprio: propria ? valor : 0,
    brutoTerceirizados: terceirizada ? valor : 0,
    comissaoCM,
    participacaoCaminhoneiros: terceirizada ? valor * ((100 - percentTerceirizada) / 100) : 0,
    receitaEmpresa: propria ? valor : comissaoCM,
    pagamentoMotoristas: propria ? valor * (percentMotorista / 100) : 0,
    brutoNaoClassificado: !propria && !terceirizada ? valor : 0,
    // Some a diferença não arredondada entre viagens e semanas; preserva
    // exatamente a fórmula antiga dos 11% quando não há nenhuma nova taxa.
    ajusteComissaoCM: taxaTerceirizadaDiferente ? valor * ((percentTerceirizada - PERCENTUAL_C_M_TERCEIRIZADA) / 100) : 0,
    taxaTerceirizadaDiferente,
    taxaMotoristaDiferente,
  };
}

export function somarReceitas(itens) {
  const total = repartirReceita(0, null);
  for (const item of itens) {
    for (const campo of Object.keys(total)) total[campo] += item[campo] || 0;
  }
  return fecharReceitas(total);
}

export function custoDaEmpresa(frota) {
  return frota === 'cm' || frota === 'bagaco';
}

export function fecharReceitas(total) {
  const centavos = valor => Math.round((valor + Number.EPSILON) * 100);
  const comissaoCM = centavos(total.brutoTerceirizados * 0.11 + (total.ajusteComissaoCM || 0)) / 100;
  const participacaoCaminhoneiros = (centavos(total.brutoTerceirizados) - centavos(comissaoCM)) / 100;
  return { ...total, comissaoCM, participacaoCaminhoneiros,
    receitaEmpresa: total.brutoProprio + comissaoCM };
}

/** Mantém rótulos de relatórios antigos e não afirma uma taxa fixa quando diverge. */
export function descricoesPercentuais(total) {
  return {
    motorista: total.taxaMotoristaDiferente ? 'taxas registradas' : '10%',
    comissao: total.taxaTerceirizadaDiferente ? 'taxas registradas' : '11%',
    repasse: total.taxaTerceirizadaDiferente ? 'taxas registradas' : '89%',
  };
}
