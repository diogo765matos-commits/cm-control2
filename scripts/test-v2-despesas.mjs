import test from "node:test";
import assert from "node:assert/strict";
import {
  apagarDespesa, carregarDespesas, filtrarDespesas, juntarDespesas, resumirDespesas,
  salvarDespesa, semanaDespesa, situacaoAdiantamento, validarDespesa,
} from "../src/v2/despesas.js";

const semana = {
  id: 11, inicio: "2026-11-16", fim: "2026-11-21", caminhao_id: 2,
  despesas: [{ id: 44, data: "2026-11-17", descricao: "Abastecimento", valor: 100.10, campoLegado: "intacto" }],
};
const empresa = {
  id: 11, inicio: "2026-11-09", fim: "2026-11-14",
  despesas: [{ id: 44, data: "2026-11-09", descricao: "Adiantamento antigo sem confirmação", valor: 50 }],
};
const adiantamento = { id: 44, motorista_id: 5, data: "2026-11-18", descricao: "Adiantamento", valor: 750, recuperado: 300, adiantamento: true };
const entrada = { tipo: "motorista", vinculo: 5, data:"2026-11-18", descricao:" Adiantamento ", valor:"750,00", recuperado:"300,00", adiantamento:true };

test("semana segunda–sábado usa UTC civil e mantém semana legada inclusive domingo", () => {
  assert.deepEqual(semanaDespesa("2026-11-21"), { inicio:"2026-11-16", fim:"2026-11-21" });
  assert.deepEqual(semanaDespesa("2027-01-01"), { inicio:"2026-12-28", fim:"2027-01-02" });
  assert.throws(() => semanaDespesa("2026-11-22"), /Domingo/);
  assert.throws(() => semanaDespesa("2026-02-30"), /válida/);
  const legado = {...semana, fim:"2026-11-22"};
  assert.strictEqual(semanaDespesa("2026-11-22", [legado]), legado);
  assert.throws(() => semanaDespesa("2026-11-21", [legado, semana]), /sobreposição/);
});

test("central mantém os três lançamentos e IDs coincidentes em fontes diferentes, sem adivinhar adiantamentos antigos", () => {
  const itens = juntarDespesas([empresa], [semana], [adiantamento]);
  assert.equal(itens.length, 3);
  assert.equal(new Set(itens.map(i => i.chave)).size, 3);
  assert.equal(itens.find(i => i.tipo === "empresa").adiantamento, false);
  assert.equal(itens.find(i => i.tipo === "caminhao").valor, 100.10);
  const destaSemana = filtrarDespesas(itens, { semana:"2026-11-16:2026-11-21" });
  assert.deepEqual(resumirDespesas(destaSemana), {
    quantidade:2, efetivas:100.10, maior:100.10, media:100.10, adiantado:750,
    recuperado:300, saldo:450, quantidadeAdiantamentos:1,
  });
  assert.equal(filtrarDespesas(itens, { tipo:"motorista", vinculo:"5", inicio:"2026-11-19" }).length, 0);
});

test("adiantamento é manual e guarda exatamente zero, parcial e quitado; centavos inválidos são rejeitados", () => {
  assert.equal(situacaoAdiantamento(validarDespesa(entrada)), "Pago parcialmente");
  assert.equal(situacaoAdiantamento(validarDespesa({ ...entrada, recuperado:750 })), "Quitado");
  assert.equal(situacaoAdiantamento(validarDespesa({ ...entrada, recuperado:0 })), "Pendente");
  assert.throws(() => validarDespesa({ ...entrada, recuperado:750.01 }), /valor recuperado/);
  assert.throws(() => validarDespesa({ ...entrada, recuperado:-0.01 }), /valor recuperado/);
  assert.throws(() => validarDespesa({ ...entrada, valor:"750,001" }), /duas casas/);
  assert.equal(validarDespesa({ ...entrada, tipo:"empresa" }).adiantamento, false);
  assert.equal(validarDespesa({ ...entrada, adiantamento:false }).recuperado, 0);
});

test("editar no perfil reaproveita a mesma entrada e não perde propriedades antigas", async () => {
  const original = juntarDespesas([], [semana], [])[0];
  const db = { update: async (tabela, filtro, valores) => {
    assert.equal(tabela, "despesas_semanas");
    assert.equal(new URLSearchParams(filtro).get("despesas"), "eq." + JSON.stringify(semana.despesas));
    assert.deepEqual(valores.despesas, [{ id:44, data:"2026-11-17", descricao:"Editado", valor:120, campoLegado:"intacto" }]);
    return [{...semana, ...valores}];
  }};
  await salvarDespesa(db, { ...original, descricao:"Editado", valor:"120,00" }, original);
  await assert.rejects(salvarDespesa(db, { ...original, data:"2026-11-23" }, original), /semana original/);
  await assert.rejects(salvarDespesa({ update:async () => [] }, { ...original, descricao:"Outro" }, original), /outra sessão/);
});

test("entrada geral chamada Adiantamento continua custo efetivo e grava no único repositório legado", async () => {
  const calls = [];
  const db = {
    select: async (tab) => { calls.push(tab); return [empresa]; },
    rpc: async (funcao, args) => { calls.push(funcao); return args; },
  };
  const args = await salvarDespesa(db, { ...entrada, data:"2026-11-10", tipo:"empresa" });
  assert.deepEqual(calls, ["despesas_gerais_semanas", "v2_adicionar_despesa"]);
  assert.equal(args.p_caminhao_id, null);
  assert.equal(args.p_inicio, empresa.inicio);
  assert.equal(args.p_despesa.adiantamento, undefined);
  assert.equal(args.p_despesa.descricao, "Adiantamento");
});

test("perfil do motorista filtra excluídos e exclusão não atinge mudança simultânea", async () => {
  const [item] = await carregarDespesas({ select: async (tabela, filtro) => {
    assert.equal(tabela, "v2_despesas_motoristas");
    assert.equal(new URLSearchParams(filtro).get("motorista_id"), "eq.5");
    assert.equal(new URLSearchParams(filtro).get("excluido_em"), "is.null");
    return [adiantamento];
  }}, "motorista", "5");
  await apagarDespesa({ update: async (tabela, filtro, { excluido_em }) => {
    assert.equal(tabela, "v2_despesas_motoristas");
    assert.equal(new URLSearchParams(filtro).get("recuperado"), "eq.300");
    assert.ok(Number.isFinite(Date.parse(excluido_em)));
    return [{ id:44 }];
  }}, item);
  await assert.rejects(apagarDespesa({ update: async () => [] }, item), /outra sessão/);
});


test("repetir um adiantamento após falha de rede não cria outro lançamento", async () => {
  const chaveCliente = "f462db9b-066f-42d7-a4cc-9364853c8778";
  let gravada;
  let chamadas = 0;
  const db = {
    async insert(tabela, dados) {
      assert.equal(tabela, "v2_despesas_motoristas");
      chamadas++;
      assert.equal(dados.chave_cliente, chaveCliente);
      gravada ??= { id:88, ...dados };
      throw new Error("Resposta perdida ou chave já gravada.");
    },
    async select(tabela, filtro) {
      assert.equal(tabela, "v2_despesas_motoristas");
      assert.equal(new URLSearchParams(filtro).get("chave_cliente"), "eq." + chaveCliente);
      return [gravada];
    },
  };
  assert.equal((await salvarDespesa(db, entrada, null, { chaveCliente })).id, 88);
  assert.equal((await salvarDespesa(db, entrada, null, { chaveCliente })).id, 88);
  await assert.rejects(salvarDespesa(db, { ...entrada, recuperado:301 }, null, { chaveCliente }), /já existe/i);
  assert.equal(gravada.recuperado, 300);
  assert.equal(chamadas, 3);
});
