// Uso: node scripts/test-v2-fechamento-excel.mjs /caminho/para/exceljs
import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = require(process.argv[2] || 'exceljs');
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(/^\.{1,2}\//.test(specifier) && !/\.js$/.test(specifier) ? `${specifier}.js` : specifier, context);
} });
const { gerarEBaixarPlanilha, gerarEBaixarPlanilhaGeral } = await import('../src/utils/relatorioExcel.js');
let each = [];
class Captura extends ExcelJS.Workbook {
  constructor() { super(); each.push(this); }
}
const downloads = [];
globalThis.document = {
  createElement: () => ({ click() { downloads.push(this.download); } }),
  body: { appendChild() {}, removeChild() {} },
};
const ficticia = {
  nf:'00012 A', cte:'0-13', placa:'TST9A44', data:'2026-11-19', dataEntrega:'2026-11-20',
  volFiscal:2, volEntregue:2.5, taxa:40, frota:'terceirizada',
};
const standard = {
  transportadora:'Homologação sintética', periodoLabel:'16/11/2026 a 21/11/2026',
  unidade:{rotulo:'Volume',abreviado:'Vol.',curta:'m³'}, taxa:40, comFiscal:true,
};
const mixed = {
  ...ficticia, nf:'00020 B', cte:'0-21', placa:'TST9A45',
  percentualAplicado:0, frotaRegistrada:'terceirizada',
};
const baga = {
  ...ficticia, nf:'00030', placa:'TST9A46', volEntregue:2, taxa:290, frota:'bagaco',
};
async function reopen(workbook) {
  const output = new ExcelJS.Workbook();
  await output.xlsx.load(await workbook.xlsx.writeBuffer());
  return output;
}
function row(sheet, label) {
  let cells;
  sheet.eachRow((item) => { if (item.getCell(1).value === label) cells = item; });
  assert.ok(cells, `linha ${label} em ${sheet.name}`);
  return cells;
}
const excelOptions = { ExcelJS:{ Workbook:Captura }, nomeArquivo:'isolado-v2.xlsx' };
assert.equal(await gerarEBaixarPlanilha({ ...excelOptions, ...standard, viagens:[ficticia] }),true);
assert.equal(downloads.at(-1),'isolado-v2.xlsx');
let book = await reopen(each.pop());
let sheet = book.getWorksheet('Fechamento');
let cells = row(sheet,'00012 A');
assert.equal(cells.getCell(3).value,'19/11/2026');
assert.equal(cells.getCell(13).value,'20/11/2026');
assert.equal(cells.getCell(7).value,'0-13');
assert.equal(cells.getCell(9).value,40);
assert.equal(cells.getCell(12).value,100);
assert.equal(row(sheet,'Comissão C&M dos terceirizados (11%)').getCell(9).value,11);
assert.equal(row(sheet,'Participação bruta dos caminhoneiros (89%)').getCell(9).value,89);

assert.equal(await gerarEBaixarPlanilhaGeral({ ...excelOptions, blocos:[
  { ...standard, nomeAba:'Terceirizada', comAbasPorCaminhao:true, viagens:[ficticia,mixed] },
  { ...standard, nomeAba:'Bagaço', comFiscal:false, taxa:290, viagens:[baga],
    unidade:{rotulo:'Tonelada',abreviado:'Ton.',curta:'ton'} },
] }),true);
book = await reopen(each.pop());
assert.deepEqual(book.worksheets.map(ws => ws.name), ['Terceirizada','TST9A44','TST9A45','Bagaço']);
sheet = book.getWorksheet('Terceirizada');
assert.equal(sheet.columnCount,13);
assert.equal(row(sheet,'Comissão C&M dos terceirizados (taxas registradas)').getCell(9).value,11);
assert.equal(row(sheet,'Participação bruta dos caminhoneiros (taxas registradas)').getCell(9).value,189);
assert.equal(row(sheet,'00020 B').getCell(7).value,'0-21');
assert.equal(row(book.getWorksheet('TST9A45'),'Comissão C&M dos terceirizados (taxas registradas)').getCell(9).value,0);
sheet = book.getWorksheet('Bagaço');
assert.equal(sheet.columnCount,6);
assert.equal(row(sheet,'00030').getCell(5).value,580);
assert.equal(row(sheet,'00030').getCell(6).value,'20/11/2026');
assert.equal(row(sheet,'Comissão C&M dos terceirizados (11%)').getCell(5).value,0);
console.log('PASS ExcelJS: formato completo, planilha geral/placas, NF e CT-e literais, duas datas, taxa zero, Bagaço.');
