// Monta o workbook (SheetJS) do "Fechamento Financeiro de Transporte" usado
// nos botões "Relatório Semanal (Excel)" da Frota e de cada caminhão.
//
// Existem dois formatos:
// - Completo (comFiscal: true) — usado por C&M e Terceirizada. Tem Vol.
//   Fiscal, Diferença, CT-e e separa Valor Fiscal / Complemento / Valor
//   Físico, igual à planilha que a empresa já usa.
// - Simplificado (comFiscal: false) — usado pela Frota Bagaço de Cana, que
//   não tem nota fiscal por viagem: só tonelada entregue x taxa = valor.

import { converterNumero, formatarData } from "./formatadores";

export function construirPlanilhaFechamento({
  XLSX,
  periodoLabel,
  transportadora,
  unidade,
  taxa,
  viagens,
  comFiscal,
}) {
  if (comFiscal) {
    return construirPlanilhaCompleta({
      XLSX,
      periodoLabel,
      transportadora,
      unidade,
      taxa,
      viagens,
    });
  }

  return construirPlanilhaSimplificada({
    XLSX,
    periodoLabel,
    transportadora,
    unidade,
    taxa,
    viagens,
  });
}

function construirPlanilhaCompleta({
  XLSX,
  periodoLabel,
  transportadora,
  unidade,
  taxa,
  viagens,
}) {
  const linhas = viagens.map((viagem) => {
    const volFiscal = converterNumero(viagem.volFiscal) || 0;
    const volEntregue = converterNumero(viagem.volEntregue) || 0;
    const diferenca = Number((volEntregue - volFiscal).toFixed(2));

    return {
      data: viagem.data,
      nf: viagem.nf,
      cte: viagem.cte,
      volFiscal,
      volEntregue,
      diferenca,
      valorFiscal: volFiscal * taxa,
      complemento: diferenca * taxa,
      valorFisico: volEntregue * taxa,
      dataEntrega: viagem.dataEntrega,
    };
  });

  if (linhas.length === 0) return null;

  linhas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  const totalValorFiscal = linhas.reduce((s, l) => s + l.valorFiscal, 0);
  const totalComplemento = linhas.reduce((s, l) => s + l.complemento, 0);
  const totalValorFisico = linhas.reduce((s, l) => s + l.valorFisico, 0);
  const totalVolFiscal = linhas.reduce((s, l) => s + l.volFiscal, 0);
  const totalVolEntregue = Number(
    linhas.reduce((s, l) => s + l.volEntregue, 0).toFixed(2)
  );
  const totalDiferenca = Number(
    linhas.reduce((s, l) => s + l.diferenca, 0).toFixed(2)
  );

  const aoa = [
    ["FECHAMENTO FINANCEIRO DE TRANSPORTE"],
    [
      "Período:",
      periodoLabel,
      null,
      null,
      null,
      null,
      null,
      "Transportadora:",
      transportadora,
    ],
    [
      "VALOR FISCAL TOTAL",
      null,
      null,
      null,
      "COMPLEMENTO TOTAL",
      null,
      null,
      null,
      "VALOR FISICO TOTAL",
    ],
    [
      totalValorFiscal,
      null,
      null,
      null,
      totalComplemento,
      null,
      null,
      null,
      totalValorFisico,
    ],
    [],
    [],
    [
      "Data NF",
      "Nº NF",
      `${unidade.abreviado} Fiscal    (${unidade.curta})`,
      `${unidade.abreviado} Entregue  (${unidade.curta})`,
      `Diferença     (${unidade.curta})`,
      "CT-e",
      "Transportadora",
      `Frete R$/${unidade.curta}`,
      "Valor Fiscal",
      "Complemento",
      "Valor Fisico",
      "Data Transporte",
    ],
    ...linhas.map((l) => [
      formatarData(l.data),
      l.nf || "",
      l.volFiscal,
      l.volEntregue,
      l.diferenca,
      l.cte || "",
      transportadora,
      taxa,
      l.valorFiscal,
      l.complemento,
      l.valorFisico,
      l.dataEntrega ? formatarData(l.dataEntrega) : "",
    ]),
    [
      "TOTAL GERAL= ",
      linhas.length,
      totalVolFiscal,
      totalVolEntregue,
      totalDiferenca,
      null,
      null,
      null,
      totalValorFiscal,
      totalComplemento,
      totalValorFisico,
      null,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    { s: { r: 2, c: 4 }, e: { r: 2, c: 7 } },
    { s: { r: 2, c: 8 }, e: { r: 2, c: 11 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 7 } },
    { s: { r: 3, c: 8 }, e: { r: 3, c: 11 } },
  ];

  ws["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
    { wch: 22 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");

  const wsDashboard = XLSX.utils.aoa_to_sheet([
    ["DASHBOARD"],
    [],
    ["Indicador", "Valor"],
    ["Valor Fiscal", totalValorFiscal],
    ["Complemento", totalComplemento],
    ["Valor Físico", totalValorFisico],
    ["Qtd. CT-es", linhas.filter((l) => l.cte).length],
  ]);
  XLSX.utils.book_append_sheet(wb, wsDashboard, "Dashboard");

  return wb;
}

function construirPlanilhaSimplificada({
  XLSX,
  periodoLabel,
  transportadora,
  unidade,
  taxa,
  viagens,
}) {
  const linhas = viagens.map((viagem) => {
    const volEntregue = converterNumero(viagem.volEntregue) || 0;

    return {
      data: viagem.data,
      nf: viagem.nf,
      volEntregue,
      valor: volEntregue * taxa,
      dataEntrega: viagem.dataEntrega,
    };
  });

  if (linhas.length === 0) return null;

  linhas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  const totalVolEntregue = Number(
    linhas.reduce((s, l) => s + l.volEntregue, 0).toFixed(2)
  );
  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);

  const aoa = [
    ["FECHAMENTO FINANCEIRO DE TRANSPORTE"],
    ["Período:", periodoLabel, null, "Transportadora:", transportadora],
    [`${unidade.rotulo.toUpperCase()} TOTAL`, null, "VALOR TOTAL", null, null],
    [totalVolEntregue, null, totalValor, null, null],
    [],
    [],
    [
      "Data NF",
      "Nº NF",
      `${unidade.abreviado} Entregue  (${unidade.curta})`,
      "Valor (R$)",
      "Data Transporte",
    ],
    ...linhas.map((l) => [
      formatarData(l.data),
      l.nf || "",
      l.volEntregue,
      l.valor,
      l.dataEntrega ? formatarData(l.dataEntrega) : "",
    ]),
    ["TOTAL GERAL= ", linhas.length, totalVolEntregue, totalValor, null],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    { s: { r: 2, c: 2 }, e: { r: 2, c: 4 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
    { s: { r: 3, c: 2 }, e: { r: 3, c: 4 } },
  ];

  ws["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");

  const wsDashboard = XLSX.utils.aoa_to_sheet([
    ["DASHBOARD"],
    [],
    ["Indicador", "Valor"],
    ["Valor Total", totalValor],
    [`${unidade.rotulo} Total Entregue`, totalVolEntregue],
    ["Qtd. Viagens", linhas.length],
  ]);
  XLSX.utils.book_append_sheet(wb, wsDashboard, "Dashboard");

  return wb;
}
