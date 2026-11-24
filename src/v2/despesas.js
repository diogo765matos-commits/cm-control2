const DIA = 86400000;
const LEGADO = { empresa: "despesas_gerais_semanas", caminhao: "despesas_semanas" };
const MOTORISTA = "v2_despesas_motoristas";
const TIPO = new Set(["empresa", "caminhao", "motorista"]);

function dataUTC(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const t = Date.parse(valor + "T00:00:00Z");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === valor ? new Date(t) : null;
}

export function semanaDespesa(data, semanas = []) {
  const dia = dataUTC(data);
  if (!dia) throw new Error("Informe uma data válida.");
  const semana = semanas.filter(s => s.inicio <= data && data <= s.fim);
  if (semana.length > 1) throw new Error("Há mais de uma semana cobrindo essa data. Resolva a sobreposição antes de lançar.");
  if (semana.length) return semana[0];
  const d = dia.getUTCDay();
  if (d === 0) throw new Error("Domingo não pertence à semana de segunda a sábado. Use uma data válida ou consulte o período legado correspondente.");
  const inicio = dia.getTime() - (d - 1) * DIA;
  return {
    inicio: new Date(inicio).toISOString().slice(0, 10),
    fim: new Date(inicio + 5 * DIA).toISOString().slice(0, 10),
  };
}

function centavos(valor) {
  if (typeof valor === "string") {
    valor = valor.trim();
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(valor)) return NaN;
    valor = Number(valor.replace(",", "."));
  }
  if (!Number.isFinite(valor) || valor < 0) return NaN;
  const arredondado = Math.round(valor * 100);
  return Number.isSafeInteger(arredondado) && Math.abs(valor * 100 - arredondado) < 0.00001 ? arredondado : NaN;
}

export function idDespesa(id) {
  return (typeof id === "string" || typeof id === "number") && /^[1-9]\d*$/.test(String(id)) ? String(id) : null;
}

export function validarDespesa(form, original = null) {
  if (!TIPO.has(form.tipo)) throw new Error("Selecione a forma de vinculação.");
  const vinculo = form.tipo === "empresa" ? null : idDespesa(form.vinculo);
  if (form.tipo !== "empresa" && !vinculo) throw new Error("Selecione o vínculo da despesa.");
  if (!dataUTC(form.data)) throw new Error("Informe uma data válida.");
  if (original && (original.tipo !== form.tipo || (original.vinculo !== null && String(original.vinculo) !== vinculo))) {
    throw new Error("O vínculo do lançamento original não pode ser alterado.");
  }
  const descricao = String(form.descricao ?? "").trim();
  if (!descricao) throw new Error("Informe uma descrição.");
  const valor = centavos(form.valor);
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe um valor positivo com até duas casas decimais.");
  const adiantamento = form.tipo === "motorista" && form.adiantamento === true;
  const recuperado = adiantamento ? centavos(form.recuperado ?? 0) : 0;
  if (!Number.isFinite(recuperado) || recuperado > valor) throw new Error("O valor recuperado deve ficar entre zero e o valor adiantado.");
  if (original?.adiantamento && !adiantamento && Number(original.recuperado) > 0) {
    throw new Error("Zere o valor recuperado antes de desmarcar um adiantamento.");
  }
  return { tipo: form.tipo, vinculo, data: form.data, descricao, valor: valor / 100, adiantamento, recuperado: recuperado / 100 };
}

export function situacaoAdiantamento(item) {
  if (!item.adiantamento) return null;
  const valor = centavos(Number(item.valor));
  const recuperado = centavos(Number(item.recuperado ?? 0));
  if (!recuperado) return "Pendente";
  return recuperado >= valor ? "Quitado" : "Pago parcialmente";
}

function deSemana(semana, tipo) {
  const despesas = Array.isArray(semana.despesas) ? semana.despesas : [];
  return despesas.map((item, indice) => ({
    ...item,
    chave: [tipo, semana.id, item.id ?? "legado", indice].join(":"),
    tipo,
    vinculo: tipo === "empresa" ? null : semana.caminhao_id,
    inicio: semana.inicio,
    fim: semana.fim,
    adiantamento: false,
    recuperado: 0,
    semana,
    indice,
  }));
}

function deMotorista(item) {
  let periodo;
  try {
    periodo = semanaDespesa(item.data);
  } catch {
    periodo = { inicio: item.data, fim: item.data };
  }
  return {
    ...item, ...periodo, chave: "motorista:" + item.id,
    tipo: "motorista", vinculo: item.motorista_id,
  };
}

export function juntarDespesas(gerais, caminhoes, motoristas) {
  return [
    ...gerais.flatMap(s => deSemana(s, "empresa")),
    ...caminhoes.flatMap(s => deSemana(s, "caminhao")),
    ...motoristas.map(deMotorista),
  ].sort((a, b) => String(b.data ?? b.inicio).localeCompare(String(a.data ?? a.inicio)) || a.chave.localeCompare(b.chave));
}

export function filtrarDespesas(itens, { tipo = "", vinculo = "", semana = "", inicio = "", fim = "" } = {}) {
  return itens.filter(i => (!tipo || i.tipo === tipo)
    && (!vinculo || String(i.vinculo) === String(vinculo))
    && (!semana || semana === i.inicio + ":" + i.fim)
    && (!inicio || (i.data || i.inicio) >= inicio)
    && (!fim || (i.data || i.fim) <= fim));
}

export function resumirDespesas(itens) {
  const resultado = { quantidade: 0, efetivas: 0, maior: 0, media: 0, adiantado: 0, recuperado: 0, saldo: 0, quantidadeAdiantamentos: 0 };
  let operacionais = 0;
  for (const item of itens) {
    const valor = Number(item.valor) || 0;
    resultado.quantidade++;
    if (item.adiantamento) {
      resultado.adiantado += valor;
      resultado.recuperado += Number(item.recuperado) || 0;
      resultado.quantidadeAdiantamentos++;
      continue;
    }
    resultado.efetivas += valor;
    resultado.maior = operacionais ? Math.max(resultado.maior, valor) : valor;
    operacionais++;
  }
  resultado.media = operacionais ? resultado.efetivas / operacionais : 0;
  resultado.saldo = resultado.adiantado - resultado.recuperado;
  return resultado;
}

function consulta(query) { return new URLSearchParams(query).toString(); }
const BASE = { select: "*", order: "id.asc" };

async function paginas(db, tabela, filtros = {}) {
  const limite = 500;
  const resultado = [];
  for (let offset = 0; ; offset += limite) {
    const itens = await db.select(tabela, consulta({ ...BASE, ...filtros, limit: String(limite), offset: String(offset) }));
    if (!Array.isArray(itens)) throw new Error("O servidor não devolveu a lista de despesas esperada.");
    resultado.push(...itens);
    if (itens.length < limite) return resultado;
  }
}

export async function carregarDespesas(db, tipo = "", id = "") {
  if (tipo && !TIPO.has(tipo)) throw new Error("Vínculo inválido.");
  if ((tipo === "caminhao" || tipo === "motorista") && !idDespesa(id)) return [];
  const [gerais, caminhoes, motoristas] = await Promise.all([
    !tipo || tipo === "empresa" ? paginas(db, LEGADO.empresa) : [],
    !tipo || tipo === "caminhao" ? paginas(db, LEGADO.caminhao, id ? { caminhao_id: "eq." + id } : {}) : [],
    !tipo || tipo === "motorista" ? paginas(db, MOTORISTA, id ? { motorista_id: "eq." + id, excluido_em: "is.null" } : { excluido_em: "is.null" }) : [],
  ]);
  return juntarDespesas(gerais, caminhoes, motoristas);
}

export async function buscarVinculosDespesa(db) {
  const [caminhoes, motoristas] = await Promise.all([
    paginas(db, "caminhoes", {select:"id,placa,modelo,frota"}),
    paginas(db, "v2_motoristas", {select:"id,nome,frota,ativo"}),
  ]);
  return { caminhoes, motoristas };
}

function filtroOriginalMotorista(item) {
  return consulta({
    id: "eq." + item.id,
    motorista_id: "eq." + item.vinculo,
    data: "eq." + item.data,
    descricao: "eq." + item.descricao,
    valor: "eq." + item.valor,
    adiantamento: "eq." + item.adiantamento,
    recuperado: "eq." + (item.recuperado ?? 0),
    excluido_em: "is.null",
  });
}

async function atualizarSemana(db, original, novo) {
  const { semana } = original;
  if (!semana || !Array.isArray(semana.despesas)) throw new Error("Semana original não encontrada.");
  const despesas = semana.despesas.flatMap((item, indice) => indice === original.indice ? (novo ? [{...item, ...novo}] : []) : [item]);
  const [salva] = await db.update(LEGADO[original.tipo], consulta({
    id: "eq." + semana.id,
    inicio: "eq." + semana.inicio,
    fim: "eq." + semana.fim,
    despesas: "eq." + JSON.stringify(semana.despesas),
  }), { despesas });
  if (!salva) throw new Error("A semana foi alterada em outra sessão. Reabra a despesa antes de tentar novamente.");
  return salva;
}

async function inserirDespesaMotorista(db, campos, chaveCliente) {
  try {
    const [salva] = await db.insert(MOTORISTA, { ...campos, chave_cliente: chaveCliente });
    return salva;
  } catch (erro) {
    // A resposta pode ter se perdido depois da gravação. Uma chave única permite
    // reconhecer a mesma solicitação sem duplicar nem confundir despesas iguais.
    let existente;
    try {
      [existente] = await db.select(MOTORISTA, consulta({ select:"*", chave_cliente:"eq." + chaveCliente }));
    } catch {
      throw erro;
    }
    if (!existente) throw erro;
    const corresponde = !existente.excluido_em
      && String(existente.motorista_id) === campos.motorista_id
      && existente.data === campos.data && existente.descricao === campos.descricao
      && Number(existente.valor) === campos.valor
      && existente.adiantamento === campos.adiantamento
      && Number(existente.recuperado) === campos.recuperado;
    if (!corresponde) throw new Error("Já existe um lançamento salvo para essa tentativa. Confira a Central de Despesas antes de lançar novamente.", { cause: erro });
    return existente;
  }
}

export async function salvarDespesa(db, form, original = null, tentativa = {}) {
  const validada = validarDespesa(form, original);
  const { tipo, vinculo, data, descricao, valor, adiantamento, recuperado } = validada;
  if (tipo === "motorista") {
    if (!original) semanaDespesa(data);
    else if (data !== original.data) semanaDespesa(data);
    const campos = { motorista_id: vinculo, data, descricao, valor, adiantamento, recuperado };
    const salva = original
      ? (await db.update(MOTORISTA, filtroOriginalMotorista(original), campos))[0]
      : await inserirDespesaMotorista(db, campos, tentativa.chaveCliente ?? globalThis.crypto.randomUUID());
    if (!salva) throw new Error("A despesa foi alterada em outra sessão. Reabra o lançamento antes de tentar novamente.");
    return salva;
  }
  if (original) {
    if (data !== original.data && (data < original.inicio || data > original.fim)) {
      throw new Error("A data precisa continuar na semana original para preservar o lançamento. O vínculo e o ID não são movidos automaticamente.");
    }
    return atualizarSemana(db, original, { data, descricao, valor });
  }
  const tabela = LEGADO[tipo];
  const onde = tipo === "empresa" ? {} : { caminhao_id: "eq." + vinculo };
  const semanas = await paginas(db, tabela, onde);
  const semana = semanaDespesa(data, semanas);
  const novo = { id: tentativa.id ?? Date.now(), data, descricao, valor };
  if (db.rpc) return db.rpc("v2_adicionar_despesa", {
    p_caminhao_id: vinculo, p_inicio: semana.inicio, p_fim: semana.fim, p_despesa: novo,
  });
  throw new Error("Lançamento central indisponível. A função de escrita segura ainda não está configurada.");
}

export async function apagarDespesa(db, original) {
  if (original.tipo === "motorista") {
    const [excluida] = await db.update(MOTORISTA, filtroOriginalMotorista(original), { excluido_em: new Date().toISOString() });
    if (!excluida) throw new Error("A despesa foi alterada em outra sessão e não foi excluída.");
    return;
  }
  return atualizarSemana(db, original, null);
}
