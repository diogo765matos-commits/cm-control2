import { formatarData } from "./formatadores.js";

const PRETO = "FF202020";
const DOURADO = "FF82621F";
const CLARO = "FFF5EDDA";
const BRANCO = "FFFFFFFF";
const BORDA = "FFE4E0D7";
const MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const QUANTIDADE = '#,##0.00;[Red]-#,##0.00';
const COLUNAS = 13;

function dataExcel(data) {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function pintar(celula, cor, fundo, tamanho = 11, bold = false) {
  celula.font = { name: "Calibri", size: tamanho, color: { argb: cor }, bold };
  if (fundo) celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fundo } };
  celula.alignment = { vertical: "middle", wrapText: true };
}

function faixa(ws, row, texto, fundo = PRETO, tamanho = 12) {
  ws.mergeCells(row, 1, row, COLUNAS);
  const celula = ws.getCell(row, 1);
  celula.value = texto;
  pintar(celula, BRANCO, fundo, tamanho, true);
  ws.getRow(row).height = 26;
}

function cabecalho(ws, titulo, detalhe, periodo, logoId) {
  ws.columns = [12, 14, 14, 17, 18, 17, 13, 28, 18, 20, 20, 20, 18].map(width => ({ width }));
  faixa(ws, 1, "C&M TRANSPORTES", PRETO, 20);
  ws.getRow(1).height = 38;
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  faixa(ws, 2, `${titulo}  •  ${periodo}`, PRETO, 12);
  ws.getRow(2).height = 30;
  ws.getCell("A2").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.mergeCells("B3:M3");
  ws.getCell("B3").value = detalhe;
  pintar(ws.getCell("B3"), PRETO, CLARO, 11);
  ws.getRow(3).height = 54;
  ws.addImage(logoId, { tl: { col: 0.1, row: 2.1 }, ext: { width: 64, height: 64 }, editAs: "oneCell" });
  ws.views = [{ state: "frozen", ySplit: 8, showGridLines: false }];
  ws.pageSetup = {
    paperSize: 9, orientation: "landscape", fitToPage: true,
    fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:8",
    margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 },
  };
  ws.headerFooter.oddFooter = "&LC&M Control&C&P / &N&R&A";
}

function caixas(ws, itens) {
  itens.forEach(({ titulo, valor, formato = MOEDA }, i) => {
    const inicio = i * 4 + 1, fim = i === 2 ? COLUNAS : inicio + 3;
    const fundo = i === 1 ? DOURADO : PRETO;
    ws.mergeCells(4, inicio, 4, fim);
    ws.mergeCells(5, inicio, 5, fim);
    const label = ws.getCell(4, inicio), total = ws.getCell(5, inicio);
    label.value = titulo;
    total.value = valor;
    total.numFmt = formato;
    pintar(label, BRANCO, fundo, 11, true);
    pintar(total, BRANCO, fundo, 16, true);
    label.alignment = total.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.getRow(4).height = 25;
  ws.getRow(5).height = 32;
}

function tabela(ws, { row, titulo, headers, linhas, formatos = {}, totais = {}, filtro = false, spans = headers.map(() => 1), totalLabel = "TOTAL GERAL", centralizadas = [] }) {
  faixa(ws, row, titulo, DOURADO);
  const header = row + 1, inicio = row + 2;
  const posicoes = spans.map((_, i) => 1 + spans.slice(0, i).reduce((a, b) => a + b, 0));
  const celulaEm = (r, i) => {
    if (spans[i] > 1) ws.mergeCells(r, posicoes[i], r, posicoes[i] + spans[i] - 1);
    return ws.getCell(r, posicoes[i]);
  };
  headers.forEach((valor, i) => {
    const celula = celulaEm(header, i);
    celula.value = valor;
    pintar(celula, BRANCO, PRETO, 11, true);
    celula.alignment.horizontal = "center";
  });
  ws.getRow(header).height = 38;
  linhas.forEach((linha, indice) => {
    linha.forEach((valor, i) => {
      const celula = celulaEm(inicio + indice, i);
      celula.value = valor;
      pintar(celula, PRETO, indice % 2 ? "FFF8F7F4" : BRANCO);
      celula.numFmt = formatos[i + 1] || "General";
      const centralizar = valor instanceof Date || centralizadas.includes(i + 1);
      celula.alignment.horizontal = centralizar ? "center" : typeof valor === "number" ? "right" : "left";
      celula.alignment.indent = centralizar ? 0 : 1;
      celula.border = {
        bottom: { style: "hair", color: { argb: BORDA } },
        right: { style: "thin", color: { argb: BORDA } },
      };
    });
    // Accommodate long descriptions/transportadora without cutting their text.
    ws.getRow(inicio + indice).height = Math.max(24, ...linha.map((v, i) =>
      typeof v === "string" ? Math.ceil(v.length / Math.max(8, Array.from({ length: spans[i] }, (_, j) => ws.getColumn(posicoes[i] + j).width).reduce((a, b) => a + b, 0) - 3)) * 15 : 24));
  });
  if (!linhas.length) {
    ws.mergeCells(inicio, 1, inicio, posicoes.at(-1) + spans.at(-1) - 1);
    ws.getCell(inicio, 1).value = "Sem lançamentos no período selecionado.";
    pintar(ws.getCell(inicio, 1), PRETO, CLARO);
    ws.getRow(inicio).height = 25;
  }
  const totalRow = inicio + Math.max(linhas.length, 1);
  for (let col = 1; col <= headers.length; col++) {
    const celula = celulaEm(totalRow, col - 1);
    pintar(celula, PRETO, CLARO, 11, true);
    celula.numFmt = formatos[col] || "General";
    celula.alignment.horizontal = centralizadas.includes(col) ? "center" : Object.hasOwn(totais, col) ? "right" : "left";
    celula.alignment.indent = centralizadas.includes(col) ? 0 : 1;
    celula.border = { top: { style: "thin", color: { argb: DOURADO } }, right: { style: "thin", color: { argb: BORDA } } };
    if (col === 1) celula.value = totalLabel;
    if (Object.hasOwn(totais, col)) {
      const letra = ws.getColumn(posicoes[col - 1]).letter;
      celula.value = filtro && linhas.length
        ? { formula: `SUBTOTAL(109,${letra}${inicio}:${letra}${inicio + linhas.length - 1})`, result: totais[col] }
        : totais[col];
    }
  }
  ws.getRow(totalRow).height = 34;
  if (filtro && linhas.length) ws.autoFilter = { from: { row: header, column: 1 }, to: { row: inicio + linhas.length - 1, column: headers.length } };
  return totalRow + 2;
}

function somar(itens, campo) {
  return itens.reduce((total, item) => total + (Number(item[campo]) || 0), 0);
}

function nomeUnico(placa, usados) {
  const base = String(placa || "Sem placa").replace(/[:\\/?*[\]]/g, "").replace(/^'+|'+$/g, "").slice(0, 31) || "Sem placa";
  let nome = base, sufixo = 2;
  while (usados.has(nome.toLowerCase())) {
    const fim = ` (${sufixo++})`;
    nome = base.slice(0, 31 - fim.length) + fim;
  }
  usados.add(nome.toLowerCase());
  return nome;
}

function finalizar(ws) {
  ws.pageSetup.printArea = `A1:M${ws.rowCount}`;
}

/** Presentation only: receives the existing, scoped report and per-truck totals. */
export function construirWorkbookConsulta({ ExcelJS, relatorio, grupos, logoBase64 }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "C&M Control";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const logoId = wb.addImage({ base64: logoBase64, extension: "png" });
  const periodo = `${formatarData(relatorio.inicio)} a ${formatarData(relatorio.fim)}`;
  const resumo = wb.addWorksheet("Resumo");
  cabecalho(resumo, "RESUMO DO PERÍODO", `Escopo: ${relatorio.rotuloEscopo}`, periodo, logoId);
  resumo.getColumn(2).width = 24;
  resumo.getColumn(3).width = 24;
  resumo.getColumn(4).width = 26;
  caixas(resumo, [
    { titulo: "VALOR FISCAL TOTAL", valor: relatorio.totaisRelatorio.valorFiscal },
    { titulo: "VALOR FÍSICO TOTAL", valor: relatorio.totaisRelatorio.valorFisico },
    { titulo: "COMPLEMENTO TOTAL", valor: relatorio.totaisRelatorio.complemento },
  ]);
  let row = tabela(resumo, {
    row: 7, titulo: "CONSOLIDADO POR CAMINHÃO • volumes identificados por unidade",
    headers: ["PLACA", "FROTA", "CAMINHÃO", "MOTORISTA", "VIAGENS", "UNIDADE", "VOL. ENTREGUE", "RECEITA BRUTA (R$)", "COMBUSTÍVEL (R$)", "DESPESAS (R$)", "ICMS (R$)"],
    linhas: grupos.map(g => [g.caminhao.placa || "Sem placa", g.nomeFrota, g.caminhao.modelo || "Caminhão", g.caminhao.motorista || "Não informado", g.totais.quantidadeViagens, g.unidade, g.volumeEntregue, g.totais.receitaBruta, g.totais.combustivel, g.totais.despesasCaminhao, g.totais.icms]),
    formatos: { 5: "0", 7: QUANTIDADE, 8: MOEDA, 9: MOEDA, 10: MOEDA, 11: MOEDA },
    totais: { 5: relatorio.totais.quantidadeViagens, 8: relatorio.totais.receitaBruta, 9: relatorio.totais.combustivel, 10: relatorio.totais.despesasCaminhao, 11: relatorio.totais.icms }, filtro: true, centralizadas: [5, 6],
  });
  // Never add quantities of different units together.
  row = tabela(resumo, {
    row, titulo: "VOLUMES DO PERÍODO • unidades separadas", headers: ["UNIDADE", "VOL. FISCAL", "VOL. ENTREGUE", "DIFERENÇA"],
    linhas: [
      ["m³", relatorio.totaisRelatorio.volumeFiscalM3, relatorio.totaisRelatorio.volumeEntregueM3, relatorio.totaisRelatorio.diferencaM3],
      ["ton", relatorio.totaisRelatorio.volumeFiscalTon, relatorio.totaisRelatorio.volumeEntregueTon, relatorio.totaisRelatorio.diferencaTon],
      ...(grupos.some(g => g.unidade === "unid. não identificada") ? [["Não identificada", relatorio.totaisRelatorio.volumeFiscalUnidadeDesconhecida, relatorio.totaisRelatorio.volumeEntregueUnidadeDesconhecida, relatorio.totaisRelatorio.diferencaUnidadeDesconhecida]] : []),
    ], formatos: { 2: QUANTIDADE, 3: QUANTIDADE, 4: QUANTIDADE }, spans: [2, 3, 4, 4], totalLabel: "Unidades separadas",
  });
  if (relatorio.escopoRelatorio === "todos") {
    tabela(resumo, { row, titulo: "DESPESAS GERAIS DA EMPRESA", headers: ["DATA", "DESCRIÇÃO", "VALOR (R$)"],
      linhas: relatorio.despesasGerais.map(v => [dataExcel(v.data), v.descricao || "", Number(v.valor) || 0]),
      formatos: { 1: "dd/mm/yyyy", 3: MOEDA }, totais: { 3: relatorio.totais.despesasGerais }, spans: [2, 8, 3] });
  }
  finalizar(resumo);
  const nomes = new Set(["resumo"]);
  grupos.forEach(grupo => {
    const { caminhao, registros, unidade } = grupo;
    const ws = wb.addWorksheet(nomeUnico(caminhao.placa, nomes));
    cabecalho(ws, `FECHAMENTO • ${caminhao.placa || "SEM PLACA"}`, `${grupo.nomeFrota} • ${caminhao.modelo || "Caminhão"} • Motorista: ${caminhao.motorista || "Não informado"} • Escopo: ${relatorio.rotuloEscopo}`, periodo, logoId);
    const viagens = registros.viagens;
    caixas(ws, [
      { titulo: "VALOR FISCAL TOTAL", valor: somar(viagens, "valorFiscal") },
      { titulo: "VALOR FÍSICO TOTAL", valor: somar(viagens, "valorFisico") },
      { titulo: "COMPLEMENTO TOTAL", valor: somar(viagens, "complemento") },
    ]);
    let proxima = tabela(ws, {
      row: 7, titulo: "VIAGENS • totais da tabela acompanham o filtro; caixas acima representam o período completo",
      headers: ["Nº NF", "PLACA", "DATA NF", `VOL. FISCAL (${unidade})`, `VOL. ENTREGUE (${unidade})`, `DIFERENÇA (${unidade})`, "CT-E", "TRANSPORTADORA", "FRETE R$/UNID.", "VALOR FISCAL (R$)", "COMPLEMENTO (R$)", "VALOR FÍSICO (R$)", "DATA TRANSPORTE"],
      linhas: viagens.map(v => [v.nf ?? "", caminhao.placa || "", dataExcel(v.data), v.volumeFiscal, v.volumeEntregue, v.diferenca, v.cte ?? "", v.transportadora, v.taxa, v.valorFiscal, v.complemento, v.valorFisico, dataExcel(v.dataEntrega)]),
      formatos: { 3: "dd/mm/yyyy", 4: QUANTIDADE, 5: QUANTIDADE, 6: QUANTIDADE, 9: MOEDA, 10: MOEDA, 11: MOEDA, 12: MOEDA, 13: "dd/mm/yyyy" },
      totais: { 4: somar(viagens, "volumeFiscal"), 5: somar(viagens, "volumeEntregue"), 6: somar(viagens, "diferenca"), 10: somar(viagens, "valorFiscal"), 11: somar(viagens, "complemento"), 12: somar(viagens, "valorFisico") }, filtro: true, centralizadas: [3, 7, 13],
    });
    if (registros.abastecimentos.length) proxima = tabela(ws, { row: proxima, titulo: "ABASTECIMENTOS", headers: ["DATA", "POSTO", "KM", "LITROS DIESEL", "LITROS ARLA", "VALOR TOTAL (R$)"],
      linhas: registros.abastecimentos.map(v => [dataExcel(v.data), v.posto || "", v.km ?? "", v.litrosDiesel ?? "", v.litrosArla ?? "", Number(v.valorTotal) || 0]),
      formatos: { 1: "dd/mm/yyyy", 3: QUANTIDADE, 4: QUANTIDADE, 5: QUANTIDADE, 6: MOEDA },
      totais: { 4: somar(registros.abastecimentos, "litrosDiesel"), 5: somar(registros.abastecimentos, "litrosArla"), 6: grupo.totais.combustivel }, spans: [2, 3, 2, 2, 2, 2] });
    if (registros.despesasCaminhao.length) proxima = tabela(ws, { row: proxima, titulo: "DESPESAS DO CAMINHÃO", headers: ["DATA", "DESCRIÇÃO", "VALOR (R$)"],
      linhas: registros.despesasCaminhao.map(v => [dataExcel(v.data), v.descricao || "", Number(v.valor) || 0]),
      formatos: { 1: "dd/mm/yyyy", 3: MOEDA }, totais: { 3: grupo.totais.despesasCaminhao }, spans: [2, 8, 3] });
    if (registros.icms.length) tabela(ws, { row: proxima, titulo: "ICMS LANÇADO", headers: ["DATA", "CT-E", "VALOR (R$)"],
      linhas: registros.icms.map(v => [dataExcel(v.data), v.cte ?? "", Number(v.valor) || 0]),
      formatos: { 1: "dd/mm/yyyy", 3: MOEDA }, totais: { 3: grupo.totais.icms }, spans: [2, 8, 3], centralizadas: [2] });
    finalizar(ws);
  });
  return wb;
}
