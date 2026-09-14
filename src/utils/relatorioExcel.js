// Monta e baixa o workbook (ExcelJS) do "Fechamento Financeiro de Transporte"
// usado nos botões "Relatório Semanal (Excel)" da Frota e de cada caminhão.
//
// Usa ExcelJS (carregado via CDN em index.html, window.ExcelJS) em vez do
// SheetJS porque a versão gratuita do SheetJS não escreve estilo (cores,
// negrito, preenchimento) nos arquivos gerados — só a versão paga faz isso.
// ExcelJS é 100% gratuito e roda inteiro no navegador.
//
// Existem dois formatos:
// - Completo (comFiscal: true) — usado por C&M e Terceirizada. Tem Vol.
//   Fiscal, Diferença, CT-e e separa Valor Fiscal / Valor Físico /
//   Complemento, igual à planilha que a empresa já usa.
// - Simplificado (comFiscal: false) — usado pela Frota Bagaço de Cana, que
//   não tem nota fiscal por viagem: só tonelada entregue x taxa = valor.
//
// Quando comAbasPorCaminhao é true, além da aba "Fechamento" (com todos os
// caminhões juntos) o workbook ganha uma aba extra por placa.

import { converterNumero, formatarData } from "./formatadores";

const NOME_EMPRESA = "C&M TRANSPORTES";

const NAVY = "FF1F3864";
const VERDE = "FF1E7145";
const AZUL = "FF1F5FBF";
const LARANJA = "FFD98C0A";
const BRANCO = "FFFFFFFF";
const CINZA_CLARO = "FFF2F2F2";
const CINZA_BORDA = "FFD9D9D9";
const VERDE_DIFERENCA = "FF0E8F5C";

const NUM_MOEDA = '"R$" #,##0.00';
const NUM_QTD = "#,##0.00";

export async function gerarEBaixarPlanilha({
  ExcelJS,
  nomeArquivo,
  transportadora,
  periodoLabel,
  unidade,
  taxa,
  viagens,
  comFiscal,
  comAbasPorCaminhao = false,
}) {
  if (!viagens || viagens.length === 0) return false;

  const wb = new ExcelJS.Workbook();
  wb.creator = "CM Control";
  wb.created = new Date();

  const construirAba = comFiscal ? construirAbaCompleta : construirAbaSimplificada;

  const abaGeral = wb.addWorksheet("Fechamento");
  const teveDadosGeral = construirAba(abaGeral, {
    transportadora,
    periodoLabel,
    unidade,
    taxa,
    viagens,
  });

  if (!teveDadosGeral) return false;

  if (comAbasPorCaminhao) {
    const porPlaca = new Map();

    viagens.forEach((viagem) => {
      const chave = viagem.placa || "Sem placa";

      if (!porPlaca.has(chave)) {
        porPlaca.set(chave, []);
      }

      porPlaca.get(chave).push(viagem);
    });

    const nomesUsados = new Set(["fechamento"]);

    Array.from(porPlaca.keys())
      .sort()
      .forEach((placa) => {
        const nomeAba = nomeAbaUnico(placa, nomesUsados);
        const aba = wb.addWorksheet(nomeAba);

        construirAba(aba, {
          transportadora,
          periodoLabel: `${periodoLabel}  ·  Placa ${placa}`,
          unidade,
          taxa,
          viagens: porPlaca.get(placa),
        });
      });
  }

  const buffer = await wb.xlsx.writeBuffer();
  baixarArquivo(buffer, nomeArquivo);
  return true;
}

function nomeAbaUnico(placa, nomesUsados) {
  let base = (placa || "Aba").toString().replace(/[:\\/?*[\]]/g, "").slice(0, 31);

  if (!base) base = "Aba";

  let nome = base;
  let sufixo = 2;

  while (nomesUsados.has(nome.toLowerCase())) {
    nome = `${base.slice(0, 28)}(${sufixo})`;
    sufixo += 1;
  }

  nomesUsados.add(nome.toLowerCase());
  return nome;
}

function baixarArquivo(buffer, nomeArquivo) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =========================================================================
// CABEÇALHO E CAIXAS DE TOTAIS (compartilhados pelos dois formatos)
// =========================================================================

function montarCabecalho(ws, { subtitulo, totalCols }) {
  ws.mergeCells(1, 1, 1, totalCols);
  ws.mergeCells(2, 1, 2, totalCols);
  ws.mergeCells(3, 1, 3, totalCols);

  ws.getRow(1).height = 34;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 8;

  for (let r = 1; r <= 3; r += 1) {
    for (let c = 1; c <= totalCols; c += 1) {
      ws.getCell(r, c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: NAVY },
      };
    }
  }

  const celTitulo = ws.getCell(1, 1);
  celTitulo.value = NOME_EMPRESA;
  celTitulo.font = { bold: true, size: 20, color: { argb: BRANCO } };
  celTitulo.alignment = { horizontal: "center", vertical: "middle" };

  const celSub = ws.getCell(2, 1);
  celSub.value = subtitulo;
  celSub.font = { bold: true, size: 12, color: { argb: BRANCO } };
  celSub.alignment = { horizontal: "center", vertical: "middle" };
}

function montarCaixasTotais(ws, caixas, totalCols) {
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 28;

  caixas.forEach(({ label, valor, cor, colInicio, colFim }) => {
    ws.mergeCells(4, colInicio, 4, colFim);
    ws.mergeCells(5, colInicio, 5, colFim);

    for (let r = 4; r <= 5; r += 1) {
      for (let c = colInicio; c <= colFim; c += 1) {
        ws.getCell(r, c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: cor },
        };
      }
    }

    const celLabel = ws.getCell(4, colInicio);
    celLabel.value = label;
    celLabel.font = { bold: true, size: 10, color: { argb: BRANCO } };
    celLabel.alignment = { horizontal: "center", vertical: "middle" };

    const celValor = ws.getCell(5, colInicio);
    celValor.value = valor;
    celValor.numFmt = NUM_MOEDA;
    celValor.font = { bold: true, size: 16, color: { argb: BRANCO } };
    celValor.alignment = { horizontal: "center", vertical: "middle" };
  });

  ws.mergeCells(6, 1, 6, totalCols);
  ws.mergeCells(7, 1, 7, totalCols);
}

function bordaFina() {
  return {
    top: { style: "thin", color: { argb: CINZA_BORDA } },
    left: { style: "thin", color: { argb: CINZA_BORDA } },
    bottom: { style: "thin", color: { argb: CINZA_BORDA } },
    right: { style: "thin", color: { argb: CINZA_BORDA } },
  };
}

function montarTabela(ws, { headers, linhas, linhaTotal, colunaFormatos }) {
  const totalCols = headers.length;
  const linhaCabecalho = 8;

  const headerRow = ws.getRow(linhaCabecalho);
  headers.forEach((texto, i) => {
    const cel = headerRow.getCell(i + 1);
    cel.value = texto;
    cel.font = { bold: true, size: 10, color: { argb: BRANCO } };
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cel.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cel.border = bordaFina();
  });
  headerRow.height = 32;

  linhas.forEach((linha, i) => {
    const r = linhaCabecalho + 1 + i;

    linha.forEach((valor, c) => {
      const cel = ws.getCell(r, c + 1);
      cel.value = valor;
      cel.border = bordaFina();
      cel.alignment = { vertical: "middle" };

      const formato = colunaFormatos[c + 1];
      if (formato) {
        if (formato.numFmt) cel.numFmt = formato.numFmt;
        if (formato.font) cel.font = formato.font;
      }
    });
  });

  const rTotal = linhaCabecalho + 1 + linhas.length;
  const totalRow = ws.getRow(rTotal);

  linhaTotal.forEach((valor, c) => {
    const cel = totalRow.getCell(c + 1);
    cel.value = valor;
    cel.border = bordaFina();
    cel.font = { bold: true };
    cel.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: CINZA_CLARO },
    };

    const formato = colunaFormatos[c + 1];
    if (formato && formato.numFmt) cel.numFmt = formato.numFmt;
  });

  ws.autoFilter = {
    from: { row: linhaCabecalho, column: 1 },
    to: { row: linhaCabecalho, column: totalCols },
  };

  ws.views = [{ state: "frozen", ySplit: linhaCabecalho }];
}

// =========================================================================
// FORMATO COMPLETO (C&M e Terceirizada)
// =========================================================================

function construirAbaCompleta(ws, { transportadora, periodoLabel, unidade, taxa, viagens }) {
  const linhasCalc = viagens.map((viagem) => {
    const volFiscal = converterNumero(viagem.volFiscal) || 0;
    const volEntregue = converterNumero(viagem.volEntregue) || 0;
    const diferenca = Number((volEntregue - volFiscal).toFixed(2));

    return {
      data: viagem.data,
      placa: viagem.placa || "",
      nf: viagem.nf || "",
      cte: viagem.cte || "",
      volFiscal,
      volEntregue,
      diferenca,
      valorFiscal: volFiscal * taxa,
      complemento: diferenca * taxa,
      valorFisico: volEntregue * taxa,
      dataEntrega: viagem.dataEntrega,
    };
  });

  if (linhasCalc.length === 0) return false;

  linhasCalc.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  const totalValorFiscal = linhasCalc.reduce((s, l) => s + l.valorFiscal, 0);
  const totalValorFisico = linhasCalc.reduce((s, l) => s + l.valorFisico, 0);
  const totalComplemento = linhasCalc.reduce((s, l) => s + l.complemento, 0);
  const totalVolFiscal = linhasCalc.reduce((s, l) => s + l.volFiscal, 0);
  const totalVolEntregue = Number(
    linhasCalc.reduce((s, l) => s + l.volEntregue, 0).toFixed(2)
  );
  const totalDiferenca = Number(
    linhasCalc.reduce((s, l) => s + l.diferenca, 0).toFixed(2)
  );

  const totalCols = 13;

  montarCabecalho(ws, {
    subtitulo: `FECHAMENTO FINANCEIRO DE TRANSPORTE  ·  ${transportadora}  ·  Período: ${periodoLabel}`,
    totalCols,
  });

  montarCaixasTotais(
    ws,
    [
      {
        label: "VALOR FISCAL TOTAL",
        valor: totalValorFiscal,
        cor: VERDE,
        colInicio: 1,
        colFim: 4,
      },
      {
        label: "VALOR FÍSICO TOTAL",
        valor: totalValorFisico,
        cor: AZUL,
        colInicio: 5,
        colFim: 8,
      },
      {
        label: "COMPLEMENTO TOTAL (Físico - Fiscal)",
        valor: totalComplemento,
        cor: LARANJA,
        colInicio: 9,
        colFim: totalCols,
      },
    ],
    totalCols
  );

  const headers = [
    "Nº NF",
    "PLACA",
    "DATA NF",
    `${unidade.abreviado.toUpperCase()} FISCAL (${unidade.curta})`,
    `${unidade.abreviado.toUpperCase()} ENTREGUE (${unidade.curta})`,
    `DIFERENÇA (${unidade.curta})`,
    "CT-E",
    "TRANSPORTADORA",
    "FRETE R$/UNID.",
    "VALOR FISCAL (R$)",
    "COMPLEMENTO (R$)",
    "VALOR FÍSICO (R$)",
    "DATA TRANSPORTE",
  ];

  const linhas = linhasCalc.map((l) => [
    l.nf,
    l.placa,
    formatarData(l.data),
    l.volFiscal,
    l.volEntregue,
    l.diferenca,
    l.cte,
    transportadora,
    taxa,
    l.valorFiscal,
    l.complemento,
    l.valorFisico,
    l.dataEntrega ? formatarData(l.dataEntrega) : "",
  ]);

  const linhaTotal = [
    "TOTAL GERAL",
    "",
    "",
    totalVolFiscal,
    totalVolEntregue,
    totalDiferenca,
    "",
    "",
    "",
    totalValorFiscal,
    totalComplemento,
    totalValorFisico,
    "",
  ];

  const colunaFormatos = {
    4: { numFmt: NUM_QTD },
    5: { numFmt: NUM_QTD },
    6: { numFmt: NUM_QTD, font: { bold: true, color: { argb: VERDE_DIFERENCA } } },
    9: { numFmt: NUM_MOEDA },
    10: { numFmt: NUM_MOEDA },
    11: { numFmt: NUM_MOEDA },
    12: { numFmt: NUM_MOEDA },
  };

  montarTabela(ws, { headers, linhas, linhaTotal, colunaFormatos });

  ws.columns = [
    { width: 10 },
    { width: 12 },
    { width: 13 },
    { width: 15 },
    { width: 16 },
    { width: 14 },
    { width: 9 },
    { width: 22 },
    { width: 13 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
  ];

  return true;
}

// =========================================================================
// FORMATO SIMPLIFICADO (Frota Bagaço de Cana — sem Fiscal/CT-e)
// =========================================================================

function construirAbaSimplificada(ws, { transportadora, periodoLabel, unidade, taxa, viagens }) {
  const linhasCalc = viagens.map((viagem) => {
    const volEntregue = converterNumero(viagem.volEntregue) || 0;

    return {
      data: viagem.data,
      placa: viagem.placa || "",
      nf: viagem.nf || "",
      volEntregue,
      valor: volEntregue * taxa,
      dataEntrega: viagem.dataEntrega,
    };
  });

  if (linhasCalc.length === 0) return false;

  linhasCalc.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  const totalVolEntregue = Number(
    linhasCalc.reduce((s, l) => s + l.volEntregue, 0).toFixed(2)
  );
  const totalValor = linhasCalc.reduce((s, l) => s + l.valor, 0);

  const totalCols = 6;

  montarCabecalho(ws, {
    subtitulo: `FECHAMENTO FINANCEIRO DE TRANSPORTE  ·  ${transportadora}  ·  Período: ${periodoLabel}`,
    totalCols,
  });

  montarCaixasTotais(
    ws,
    [
      {
        label: `${unidade.rotulo.toUpperCase()} TOTAL`,
        valor: totalVolEntregue,
        cor: AZUL,
        colInicio: 1,
        colFim: 3,
      },
      {
        label: "VALOR TOTAL",
        valor: totalValor,
        cor: VERDE,
        colInicio: 4,
        colFim: totalCols,
      },
    ],
    totalCols
  );

  // A primeira caixa mostra uma quantidade, não dinheiro — corrige o
  // formato numérico que montarCaixasTotais aplica por padrão (moeda).
  const celQtd = ws.getCell(5, 1);
  celQtd.numFmt = NUM_QTD;

  const headers = [
    "Nº NF",
    "PLACA",
    "DATA NF",
    `${unidade.abreviado.toUpperCase()} ENTREGUE (${unidade.curta})`,
    "VALOR (R$)",
    "DATA TRANSPORTE",
  ];

  const linhas = linhasCalc.map((l) => [
    l.nf,
    l.placa,
    formatarData(l.data),
    l.volEntregue,
    l.valor,
    l.dataEntrega ? formatarData(l.dataEntrega) : "",
  ]);

  const linhaTotal = [
    "TOTAL GERAL",
    "",
    "",
    totalVolEntregue,
    totalValor,
    "",
  ];

  const colunaFormatos = {
    4: { numFmt: NUM_QTD },
    5: { numFmt: NUM_MOEDA },
  };

  montarTabela(ws, { headers, linhas, linhaTotal, colunaFormatos });

  ws.columns = [
    { width: 10 },
    { width: 12 },
    { width: 13 },
    { width: 18 },
    { width: 16 },
    { width: 15 },
  ];

  return true;
}
