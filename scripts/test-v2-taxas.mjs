// node --test scripts/test-v2-taxas.mjs
// Exercita as agregações reais com a conexão PostgREST substituída por fixtures.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import {
  descricoesPercentuais, frotaEfetivaViagem, repartirReceita, somarReceitas,
} from "../src/utils/receitaEmpresa.js";

const fakeDb = "data:text/javascript,export const db={select:(...args)=>globalThis.__cmV2Select(...args)}";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "../lib/supabase") return { shortCircuit: true, url: fakeDb };
  if (/^\.{1,2}\//.test(specifier) && !/\.js$/.test(specifier)) {
    return nextResolve(`${specifier}.js`, context);
  }
  return nextResolve(specifier, context);
} });
const { calcularResumoPorPeriodo, somarPeriodos } = await import("../src/utils/resumoPeriodos.js");
const {
  consultarLancamentosPorPeriodo, filtrarConsultaPorEscopo,
} = await import("../src/data/consultaPeriodo.js");

const legado = (frota, bruto) => repartirReceita(bruto, frota);
const salvo = (frota, bruto, percentualAplicado) => repartirReceita(
  bruto, frota, { frotaRegistrada: frota, percentualAplicado },
);

test("histórico: retenção de 11% sobre o bruto agregado, remuneração própria e bagaço a 10%", () => {
  const brutos = [0.047, 0.047, 123.47, 987.39];
  const total = somarReceitas([
    ...brutos.map((valor) => legado("terceirizada", valor)),
    legado("cm", 1500),
    legado("bagaco", 290),
  ]);
  const brutoTerceiro = brutos.reduce((sum, item) => sum + item, 0);
  const centavos = (v) => Math.round((v + Number.EPSILON) * 100);
  assert.equal(total.comissaoCM, centavos(brutoTerceiro * 0.11) / 100);
  assert.equal(total.participacaoCaminhoneiros,
    (centavos(brutoTerceiro) - centavos(total.comissaoCM)) / 100);
  assert.equal(total.receitaEmpresa, 1790 + total.comissaoCM);
  assert.equal(total.pagamentoMotoristas, 179);
  assert.deepEqual(descricoesPercentuais(total), { motorista: "10%", comissao: "11%", repasse: "89%" });
});

test("registros V2 usam a taxa salva, incluindo zero, sem afetar bagaço nem interpretar inválidos", () => {
  const total = somarReceitas([
    legado("terceirizada", 200),
    salvo("terceirizada", 200, 0),
    salvo("terceirizada", 300, 12.5),
    legado("cm", 1000),
    salvo("cm", 1000, 0),
    salvo("cm", 1000, 15),
    salvo("bagaco", 290, 40),
  ]);
  assert.equal(total.comissaoCM, 59.5);
  assert.equal(total.participacaoCaminhoneiros, 640.5);
  assert.equal(total.pagamentoMotoristas, 279);
  assert.deepEqual(descricoesPercentuais(total), {
    motorista: "taxas registradas", comissao: "taxas registradas", repasse: "taxas registradas",
  });
  for (const invalido of [null, "", 101, -1, Infinity, "0"]) {
    assert.equal(somarReceitas([salvo("terceirizada", 100, invalido)]).comissaoCM, 11);
    assert.equal(somarReceitas([salvo("cm", 100, invalido)]).pagamentoMotoristas, 10);
  }
  assert.equal(frotaEfetivaViagem({ frotaRegistrada: "terceirizada" }, "cm"), "terceirizada");
});

const ids = [1, 2, 3];
const caminhoes = [{ id: ids[0], frota: "cm" }, { id: ids[1], frota: "terceirizada" }, { id: ids[2], frota: "bagaco" }];
const frotas = new Map(caminhoes.map((c) => [c.id, c.frota]));
function viagem(id, dataEntrega, volEntregue, taxa, extra = {}) {
  return { id, nf: String(id), data: "2026-10-05", dataEntrega, volEntregue, taxa, ...extra };
}
const semanas = [
  { id: 1, caminhao_id: 1, inicio: "2026-10-05", fim: "2026-10-10", viagens: [
    viagem(101, "2026-10-06", 10, 10),
    viagem(102, "2026-10-07", 20, 10, { frotaRegistrada: "cm", percentualAplicado: 15 }),
    viagem(103, "2026-10-08", 30, 10, { frotaRegistrada: "terceirizada", percentualAplicado: 0 }),
  ] },
  { id: 2, caminhao_id: 2, inicio: "2026-10-05", fim: "2026-10-10", viagens: [
    viagem(201, "2026-10-09", 20, 10),
    viagem(202, "2026-10-12", 30, 10, { frotaRegistrada: "terceirizada", percentualAplicado: 12.5 }),
  ] },
  { id: 3, caminhao_id: 3, inicio: "2026-10-12", fim: "2026-10-17", viagens: [
    viagem(301, "2026-10-12", 2, 290),
  ] },
];
const despesas = [{ id: 1, caminhao_id: 1, inicio: "2026-10-05", fim: "2026-10-10",
  despesas: [{ id: 100, valor: 25, data: "2026-10-09", descricao: "Sintética" }] }];

test("resumo de semanas e consulta por entrega somam os valores V2 sem regravar nem duplicar viagens", async () => {
  const fonte = JSON.stringify({ semanas, despesas });
  const resumo = somarPeriodos(calcularResumoPorPeriodo(semanas, [], despesas, { frotaPorCaminhao: frotas }));
  assert.equal(resumo.totalViagens, 6);
  assert.equal(resumo.totalDespesasExtras, 25);
  assert.equal(resumo.receitaBruta, 1680);
  assert.equal(resumo.comissaoCM, 59.5);
  assert.equal(resumo.pagamentoMotoristas, 98);
  globalThis.__cmV2Select = async (tabela) => ({
    caminhoes, viagens_semanas: semanas, despesas_semanas: despesas,
  })[tabela] || [];
  const consulta = await consultarLancamentosPorPeriodo("2026-10-06", "2026-10-12");
  assert.equal(consulta.totais.receitaBruta, resumo.receitaBruta);
  assert.equal(consulta.totais.comissaoCM, resumo.comissaoCM);
  assert.equal(consulta.totais.pagamentoMotoristas, resumo.pagamentoMotoristas);
  assert.equal(consulta.totais.toneladasEntregues, 2);
  assert.equal(consulta.totais.volumeEntregueM3, 110);
  const terceirizada = filtrarConsultaPorEscopo(consulta, "terceirizada");
  assert.deepEqual(terceirizada.viagens.map(({ id }) => id), [103, 201, 202]);
  const entreguesNaPrimeiraSemana = await consultarLancamentosPorPeriodo("2026-10-06", "2026-10-10");
  assert.deepEqual(entreguesNaPrimeiraSemana.viagens.map(({ id }) => id), [101, 102, 103, 201]);
  assert.equal(entreguesNaPrimeiraSemana.totais.comissaoCM, 22);
  assert.equal(JSON.stringify({ semanas, despesas }), fonte);
});

test("semanas com taxas fracionárias preservam precisão até o fechamento total", () => {
  const secoes = [
    { id: 8, caminhao_id: 2, inicio: "2026-10-05", fim: "2026-10-10", viagens: [
      viagem(901, "2026-10-06", 1, 0.047, { frotaRegistrada: "terceirizada", percentualAplicado: 15 }),
    ] },
    { id: 9, caminhao_id: 2, inicio: "2026-10-12", fim: "2026-10-17", viagens: [
      viagem(902, "2026-10-13", 1, 0.047, { frotaRegistrada: "terceirizada", percentualAplicado: 15 }),
    ] },
  ];
  const periodos = calcularResumoPorPeriodo(secoes, [], [], { frotaPorCaminhao: frotas });
  assert.deepEqual(periodos.map((semana) => semana.comissaoCM), [0.01, 0.01]);
  const total = somarPeriodos(periodos);
  assert.equal(total.comissaoCM, 0.01, "não deve somar retenções já arredondadas");
  assert.equal(total.participacaoCaminhoneiros, 0.08);
});

test("NF terceirizada legada em dois perfis permanece uma única viagem contábil", async () => {
  const { motoristaDaViagem } = await import("../src/v2/regras.js");
  const motoristaCem = {id: 91, nome:"Motorista C&M sintético", frota:"cm", ativo:true};
  const motoristaTer = {id: 92, nome:"Motorista terceiro sintético", frota:"terceirizada",
    ativo:true, caminhao_origem_id:2};
  const frota = [{ ...caminhoes[0], motorista:motoristaCem.nome },
    { ...caminhoes[1], motorista:motoristaTer.nome }];
  const registroCem = viagem(801,"2026-10-07",50,40,{nf:"NF-CEM"});
  const registroTer = viagem(802,"2026-10-08",250,40,{nf:"NF-TERC"});
  const semanasLocais = frota.map((c,i) => ({
    id:i+1, caminhao_id:c.id, inicio:"2026-10-05", fim:"2026-10-10",
    viagens:[[registroCem,registroTer][i]],
  }));
  const perfilCaminhao = (id) => semanasLocais.filter(s=>s.caminhao_id===id).flatMap(s=>s.viagens);
  const perfisMotoristas = [motoristaCem,motoristaTer];
  const perfilMotorista = (id) => frota.flatMap(c => perfilCaminhao(c.id)
    .filter(v=>motoristaDaViagem(v,c,perfisMotoristas)?.id===id));
  assert.deepEqual(perfilCaminhao(2),[registroTer]);
  assert.deepEqual(perfilMotorista(92),[registroTer]);
  assert.strictEqual(perfilCaminhao(2)[0],perfilMotorista(92)[0],"os dois perfis consultam o mesmo objeto de origem");
  assert.deepEqual(perfilCaminhao(1),[registroCem]);
  assert.deepEqual(perfilMotorista(91),[]);
  globalThis.__cmV2Select = async tabela => ({caminhoes:frota,viagens_semanas:semanasLocais})[tabela] || [];
  const registros = await consultarLancamentosPorPeriodo("2026-10-05","2026-10-10");
  const { viagens, totais } = filtrarConsultaPorEscopo(registros,"terceirizada");
  assert.deepEqual(viagens.map(v=>v.nf),["NF-TERC"]);
  assert.equal(totais.quantidadeViagens,1);
  assert.equal(totais.receitaBruta,10000);
  assert.equal(totais.comissaoCM,1100);
  assert.equal(totais.participacaoCaminhoneiros,8900);
  assert.equal(registros.totais.quantidadeViagens,2);
});
