// Run with: node scripts/test-consulta-excel.mjs <local ExcelJS 4.4.0 bundle>
// Uses the same ExcelJS bundle as index.html; no database/network writes.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { construirWorkbookConsulta } from "../src/utils/consultaPeriodoExcel.js";
import { converterNumero, formatarData } from "../src/utils/formatadores.js";

const require = createRequire(import.meta.url);
const ExcelJS = require(process.argv[2]);
const espree = require("espree");
const constants = {
  FROTA_CM: "cm", FROTA_BAGACO: "bagaco", FROTA_TERCEIRIZADA: "terceirizada",
  FROTAS: [{ tipo: "cm", titulo: "Frota C&M" }, { tipo: "bagaco", titulo: "Frota de Bagaço de Cana" }, { tipo: "terceirizada", titulo: "Frota Terceirizada" }],
};
function carregar(source, names, scope) {
  const ast = espree.parse(source, { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true }, range: true });
  for (const node of ast.body.filter(n => n.type === "ImportDeclaration").reverse()) source = source.slice(0, node.start) + source.slice(node.end);
  source = source.replace(/^export /gm, "");
  return new Function(...Object.keys(scope), source + `\nreturn {${names.join(",")}};`)(...Object.values(scope));
}
const caminhoes = [
  { id: 1, placa: "TST0001", modelo: "Teste C&M", motorista: "Motorista de teste", frota: "cm" },
  { id: 2, placa: "TST0002", modelo: "Teste terceiro", frota: "terceirizada" },
  { id: 3, placa: "TST0003", modelo: "Teste bagaço", frota: "bagaco" },
];
const rawViagens = caminhoes.map((c, i) => ({ id: i + 1, nf: "000" + (i + 1), cte: "", data: "2026-08-01", dataEntrega: "2026-09-30", volFiscal: 10 + i, volEntregue: 12 + i, taxa: 7.123 }));
const db = { select: async table => {
  if (table === "caminhoes") return caminhoes;
  if (table === "viagens_semanas") return caminhoes.map((c, i) => ({ id: i, caminhao_id: c.id, inicio: "2026-01-01", fim: "2026-01-07", viagens: [rawViagens[i], { ...rawViagens[i], id: 999, dataEntrega: "2026-10-10" }] }));
  if (table === "despesas_semanas") return [{ caminhao_id: 1, despesas: [{ id: 1, data: "2026-09-30", descricao: "ABASTECIMENTO - manter como despesa", valor: 45.67 }] }];
  if (table === "despesas_gerais_semanas") return [{ despesas: [{ id: 2, data: "2026-09-29", descricao: "Despesa geral de teste", valor: 99.12 }] }];
  return [];
} };
const dataFns = carregar(fs.readFileSync("src/data/consultaPeriodo.js", "utf8"), ["consultarLancamentosPorPeriodo", "filtrarConsultaPorEscopo", "calcularTotaisConsulta"], { ...constants, db, converterNumero, taxaEfetivaViagem: v => v.taxa });
const page = fs.readFileSync("src/pages/ConsultaPeriodo.jsx", "utf8").split("function Tabela(")[0];
const pageFns = carregar(page, ["criarDadosRelatorio", "agruparCaminhoes", "ordenarPorFrotaECaminhao", "tituloFrota", "unidadeVisivel"], {
  ...constants, ...dataFns, formatarData,
  TRANSPORTADORA_CM: "Transportadora de teste", TRANSPORTADORA_TERCEIRIZADA: "Transportadora terceira de teste",
  unidadeDaFrota: frota => ({ curta: frota === "bagaco" ? "ton" : "m³" }),
});
const consulta = await dataFns.consultarLancamentosPorPeriodo("2026-09-28", "2026-10-05");
assert.equal(consulta.viagens.length, 3, "filter must continue using dataEntrega, not week/NF date");
const logoBase64 = fs.readFileSync("src/assets/logo.png").toString("base64");
function gerar(consultaEscopo, escopo) {
  const relatorio = pageFns.criarDadosRelatorio(consultaEscopo, escopo, "Escopo de teste");
  const grupos = pageFns.agruparCaminhoes(relatorio).map(g => ({ ...g,
    nomeFrota: pageFns.tituloFrota(g.caminhao.frota), unidade: pageFns.unidadeVisivel(g.caminhao.frota),
    volumeEntregue: g.caminhao.frota === "bagaco" ? g.totais.toneladasEntregues : g.caminhao.frota ? g.totais.volumeEntregueM3 : g.totais.volumeUnidadeDesconhecida,
    registros: { ...g.registros, viagens: pageFns.ordenarPorFrotaECaminhao(g.registros.viagens) },
  }));
  return { wb: construirWorkbookConsulta({ ExcelJS, relatorio, grupos, logoBase64 }), relatorio, grupos };
}
for (const [escopo, id, expected] of [["todos", "", 4], ["cm", "", 3], ["terceirizada", "", 2], ["caminhao", "1", 2]]) {
  const scoped = dataFns.filtrarConsultaPorEscopo(consulta, escopo, id);
  const snapshot = JSON.stringify(scoped);
  const { wb, relatorio, grupos } = gerar(scoped, escopo);
  assert.equal(JSON.stringify(scoped), snapshot, "export must not mutate source data");
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(await wb.xlsx.writeBuffer());
  assert.equal(reloaded.worksheets.length, expected);
  assert.equal(reloaded.worksheets[0].name, "Resumo");
  assert.deepEqual(reloaded.worksheets.slice(1).map(s => s.name).sort(), grupos.map(g => g.caminhao.placa).sort());
  assert.equal(reloaded.getWorksheet("Resumo").getCell("E5").value, relatorio.totais.receitaBruta);
  assert.equal(reloaded.getWorksheet("Resumo").getCell("E9").alignment.horizontal, "center");
  assert.equal(reloaded.getWorksheet("Resumo").getCell("F9").alignment.horizontal, "center");
  assert.equal(reloaded.getWorksheet("Resumo").getCell(`G${9 + grupos.length}`).value, null, "no aggregate mixing m³ and tons");
  const resumoTexto = JSON.stringify(reloaded.getWorksheet("Resumo").model);
  assert.equal(resumoTexto.includes("Despesa geral de teste"), escopo === "todos");
  for (const grupo of grupos) {
    const ws = reloaded.getWorksheet(grupo.caminhao.placa);
    assert.deepEqual(ws.getRow(8).values.slice(1), ["Nº NF", "PLACA", "DATA NF", `VOL. FISCAL (${grupo.unidade})`, `VOL. ENTREGUE (${grupo.unidade})`, `DIFERENÇA (${grupo.unidade})`, "CT-E", "TRANSPORTADORA", "FRETE R$/UNID.", "VALOR FISCAL (R$)", "COMPLEMENTO (R$)", "VALOR FÍSICO (R$)", "DATA TRANSPORTE"]);
    assert.equal(ws.getCell("A9").value, grupo.registros.viagens[0].nf);
    assert.equal(ws.getCell("G9").value, "");
    assert.equal(ws.getCell("L9").value, grupo.registros.viagens[0].valorFisico);
    assert.ok(ws.getCell("L9").numFmt.includes("R$"));
    assert.ok(!ws.getCell("E9").numFmt.includes("R$"));
    assert.equal(ws.getCell("M9").numFmt, "dd/mm/yyyy");
    for (const address of ["C9", "G9", "M9"]) assert.equal(ws.getCell(address).alignment.horizontal, "center");
    assert.equal(ws.getCell("F9").alignment.indent, 1);
    assert.equal(ws.getCell("L9").border.right.style, "thin");
    assert.equal(ws.autoFilter, "A8:M9");
    assert.equal(ws.getCell("L10").value.result, grupo.registros.viagens[0].valorFisico);
    assert.equal(ws.getCell("L10").value.formula, "SUBTOTAL(109,L9:L9)");
    assert.equal(ws.pageSetup.orientation, "landscape");
    assert.equal(ws.pageSetup.fitToHeight, 0);
    assert.equal(ws.views[0].ySplit, 8);
    assert.equal(ws.getImages().length, 1);
  }
  assert.equal(reloaded.model.media.length, 1, "embedded logo shared across sheets");
  console.log(`PASS ${escopo}: structure, values, scope, dates, IDs, totals, styles, print, embedded logo`);
}
const empty = { ...consulta, caminhoes: [], viagens: [], abastecimentos: [], despesasCaminhao: [], despesasGerais: [], icms: [] };
assert.equal(gerar(empty, "todos").wb.worksheets.length, 1);
const collisions = { ...consulta, caminhoes: caminhoes.map(c => ({ ...c, placa: "Resumo" })), viagens: [], despesasCaminhao: [] };
assert.deepEqual(gerar(collisions, "todos").wb.worksheets.map(s => s.name), ["Resumo", "Resumo (2)", "Resumo (3)", "Resumo (4)"]);
const unknown = { ...empty, caminhoes: [{ id: 99, placa: "UNKNOWN", frota: null }], viagens: [{ ...consulta.viagens[0], caminhaoId: 99, caminhao: { id: 99, placa: "UNKNOWN", frota: null }, nf: "00009", cte: "" }] };
const unknownBook = gerar(unknown, "todos").wb;
assert.equal(unknownBook.getWorksheet("UNKNOWN").getCell("D8").value, "VOL. FISCAL (unid. não identificada)");
assert.ok(JSON.stringify(unknownBook.getWorksheet("Resumo").model).includes("Não identificada"));
console.log("PASS empty scope and duplicate/reserved worksheet names; no mixed-unit aggregate");

// Exercise the real component's state/handlers without duplicating their logic.
// JSX/browser layout is deliberately not asserted by this hook harness.
const pageSource = fs.readFileSync("src/pages/ConsultaPeriodo.jsx", "utf8");
const pageAst = espree.parse(pageSource, { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true }, range: true });
const component = pageAst.body.find(n => n.type === "FunctionDeclaration" && n.id.name === "ConsultaPeriodo");
const renderReturn = component.body.body.find(n => n.type === "ReturnStatement");
const componentLogic = pageSource.slice(component.start, renderReturn.start) + "return { inicio, fim, relatorio, dadosExibidos, exportando, carregando, erro, mudarPeriodo, mudarEscopo, mudarCaminhao, consultar, baixarExcel }; }";
function harness() {
  const slots = []; let cursor = 0;
  const pendingQueries = [], pendingExports = [], downloads = [];
  const scope = { ...constants, ...dataFns, ...pageFns,
    ESCOPO_TODOS: "todos", ESCOPO_FROTA_CM: "cm", ESCOPO_FROTA_TERCEIRIZADA: "terceirizada", ESCOPO_CAMINHAO: "caminhao",
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo: fn => fn(),
    consultarLancamentosPorPeriodo: (inicio, fim) => new Promise((resolve, reject) => pendingQueries.push({ inicio, fim, resolve, reject })),
    exportarExcel: async (snapshot, aindaAtual) => {
      await new Promise(resolve => pendingExports.push(resolve));
      if (aindaAtual()) downloads.push(snapshot);
    },
  };
  const Component = new Function(...Object.keys(scope), componentLogic + ";return ConsultaPeriodo;")(...Object.values(scope));
  return { render: () => { cursor = 0; return Component(); }, pendingQueries, pendingExports, downloads };
}
const h = harness();
let view = h.render();
view.mudarPeriodo("inicio", consulta.inicio); view.mudarPeriodo("fim", consulta.fim);
view = h.render();
const querying = view.consultar({ preventDefault() {} });
assert.equal(h.render().relatorio, null);
h.pendingQueries.shift().resolve(consulta); await querying;
for (const escopo of ["cm", "terceirizada", "todos", "cm", "terceirizada"]) {
  h.render().mudarEscopo(escopo); view = h.render();
  assert.equal(view.relatorio.escopoRelatorio, escopo);
  assert.equal(view.dadosExibidos, view.relatorio, "preview and download must share the same snapshot");
  const expectedIds = escopo === "cm" ? [1, 3] : escopo === "terceirizada" ? [2] : [1, 2, 3];
  assert.deepEqual(view.relatorio.caminhoes.map(c => c.id), expectedIds);
  const downloading = view.baixarExcel();
  h.pendingExports.shift()(); await downloading;
  assert.equal(h.downloads.at(-1), view.relatorio);
}
h.render().mudarEscopo("caminhao"); assert.equal(h.render().relatorio, null);
for (const id of [1, 3, 2, 1]) {
  h.render().mudarCaminhao(String(id)); view = h.render();
  assert.deepEqual(view.relatorio.caminhoes.map(c => c.id), [id]);
  assert.ok(view.relatorio.nomeArquivoEscopo.includes(caminhoes[id - 1].placa));
  assert.ok(view.relatorio.rotuloEscopo.includes(id === 3 ? "ton" : "m³"));
}
h.render().mudarCaminhao("missing"); assert.equal(h.render().relatorio, null);
h.render().mudarEscopo("cm"); view = h.render();
let downloading = view.baixarExcel();
const count = h.downloads.length;
h.render().mudarEscopo("terceirizada");
h.pendingExports.shift()(); await downloading;
assert.equal(h.downloads.length, count, "changing scope must cancel the prepared download");
view = h.render(); downloading = view.baixarExcel();
h.render().mudarPeriodo("fim", "2026-10-06");
assert.equal(h.render().relatorio, null, "date edits invalidate displayed/exportable data immediately");
h.pendingExports.shift()(); await downloading;
assert.equal(h.downloads.length, count);
view = h.render(); const stale = view.consultar({ preventDefault() {} });
const staleRequest = h.pendingQueries.shift();
h.render().mudarPeriodo("fim", "2026-10-07");
const fresh = h.render().consultar({ preventDefault() {} });
h.pendingQueries.shift().resolve({ ...empty, fim: "2026-10-07" }); await fresh;
staleRequest.resolve({ ...consulta, fim: "2026-10-06" }); await stale;
view = h.render();
assert.equal(view.relatorio.fim, "2026-10-07");
assert.equal(view.relatorio.totais.quantidadeViagens, 0);
assert.equal(view.relatorio.escopoRelatorio, "terceirizada");
assert.equal(view.carregando, false);
console.log("PASS real component handlers: repeated scopes/trucks, shared preview/export snapshot, distinct filenames, invalid selection, empty results, stale query/download cancellation");

// Also check the cancellation gate in the actual browser exporter after its
// asynchronous buffer generation, not only the state handler's callback.
let releaseBuffer, bufferStarted, current = true;
const started = new Promise(resolve => { bufferStarted = resolve; });
const links = [];
const browserExporter = carregar(page, ["exportarExcel"], {
  ...constants, ...dataFns, formatarData, logoUrl: "bundled-logo.png",
  unidadeDaFrota: frota => ({ curta: frota === "bagaco" ? "ton" : "m³" }),
  window: { ExcelJS },
  fetch: async () => ({ ok: true, blob: async () => ({}) }),
  FileReader: class { readAsDataURL() { this.result = logoBase64; this.onload(); } },
  construirWorkbookConsulta: () => ({ xlsx: { writeBuffer: () => new Promise(resolve => { releaseBuffer = resolve; bufferStarted(); }) } }),
  document: { createElement: () => { const link = {}; links.push(link); return link; } },
  URL: { createObjectURL: () => { throw new Error("stale export must not create a download URL"); } },
});
const exportSnapshot = gerar(consulta, "todos").relatorio;
const canceledExport = browserExporter.exportarExcel(exportSnapshot, () => current);
await started;
current = false; releaseBuffer(new Uint8Array());
assert.equal(await canceledExport, false);
assert.equal(links.length, 0);
console.log("PASS actual browser exporter: no download link created after selection changes during buffer generation");
