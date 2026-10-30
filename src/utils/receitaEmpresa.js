import { PERCENTUAL_MOTORISTA } from '../data/config.js';

// Projeção somente de leitura. Não altera viagens nem fechamentos semanais.
// Os 89% são participação bruta do caminhoneiro, não um líquido a pagar.
export function repartirReceita(bruto, frota) {
  const valor = Number(bruto) || 0;
  const terceirizada = frota === 'terceirizada';
  const propria = frota === 'cm' || frota === 'bagaco';
  return {
    receitaBruta: valor,
    brutoProprio: propria ? valor : 0,
    brutoTerceirizados: terceirizada ? valor : 0,
    comissaoCM: terceirizada ? valor * 0.11 : 0,
    participacaoCaminhoneiros: terceirizada ? valor * 0.89 : 0,
    receitaEmpresa: propria ? valor : terceirizada ? valor * 0.11 : 0,
    pagamentoMotoristas: propria ? valor * PERCENTUAL_MOTORISTA : 0,
    brutoNaoClassificado: !propria && !terceirizada ? valor : 0,
  };
}

export function somarReceitas(itens) {
  const total = repartirReceita(0, null);
  for (const item of itens) {
    for (const campo of Object.keys(total)) total[campo] += item[campo] || 0;
  }
  return fecharReceitas(total);
}

// Usado nas projeções empresariais. Custos dos terceirizados não pertencem à C&M.
export function custoDaEmpresa(frota) {
  return frota === 'cm' || frota === 'bagaco';
}

// Arredonda só as novas participações de apresentação no total consultado.
// O bruto e o pagamento dos motoristas próprios continuam com a precisão anterior.
export function fecharReceitas(total) {
  const centavos = valor => Math.round((valor + Number.EPSILON) * 100);
  const comissaoCM = centavos(total.brutoTerceirizados * 0.11) / 100;
  const participacaoCaminhoneiros = (centavos(total.brutoTerceirizados) - centavos(comissaoCM)) / 100;
  return { ...total, comissaoCM, participacaoCaminhoneiros,
    receitaEmpresa: total.brutoProprio + comissaoCM };
}
