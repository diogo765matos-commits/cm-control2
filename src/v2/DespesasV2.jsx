import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/supabase";
import { formatarData, formatarMoeda } from "../utils/formatadores";
import {
  apagarDespesa, buscarVinculosDespesa, carregarDespesas, filtrarDespesas,
  idDespesa, resumirDespesas, salvarDespesa, situacaoAdiantamento,
} from "./despesas";

const TIPOS = [
  { valor: "", nome: "Todas" },
  { valor: "empresa", nome: "Empresa" },
  { valor: "caminhao", nome: "Caminhões" },
  { valor: "motorista", nome: "Motoristas" },
];
const CAMINHO = "/lancamentos/despesa";
const INICIAL = { tipo: "empresa", vinculo: "", data: "", descricao: "", valor: "", adiantamento: false, recuperado: 0 };

function useCarregamento(tipo = "", id = "", lerItens = true) {
  const identidade = [tipo, id, lerItens].join(":");
  const [estado, setEstado] = useState({ itens: [], caminhoes: [], motoristas: [], carregando: true, erro: "" });
  const [versao, setVersao] = useState(0);
  const atualizar = useCallback(() => setVersao(v => v + 1), []);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      lerItens ? carregarDespesas(db, tipo, id) : [],
      buscarVinculosDespesa(db),
    ]).then(([itens, vinculos]) => {
      if (vivo) setEstado({ itens, ...vinculos, carregando: false, erro: "", identidade });
    }).catch(erro => {
      if (vivo) setEstado({ itens: [], caminhoes: [], motoristas: [], carregando: false, erro: erro.message, identidade });
    });
    return () => { vivo = false; };
  }, [tipo, id, lerItens, identidade, versao]);
  return { ...estado, carregando: estado.identidade !== identidade, atualizar };
}

function vinculoNome(i, caminhoes, motoristas) {
  if (i.tipo === "empresa") return "Empresa";
  const busca = (i.tipo === "caminhao" ? caminhoes : motoristas).find(v => String(v.id) === String(i.vinculo));
  return i.tipo === "caminhao" ? (busca?.placa ?? "Caminhão") : (busca?.nome ?? "Motorista");
}

function perfilUrl(tipo, id) {
  if (tipo === "motorista") return "/frota/motorista/" + id;
  if (tipo === "caminhao") return "/caminhao/" + id;
  return "/despesas";
}

function urlEdicao(item) {
  const q = new URLSearchParams({ editar: item.chave, tipo: item.tipo });
  if (item.vinculo != null) q.set(item.tipo, item.vinculo);
  return CAMINHO + "?" + q.toString();
}

function Medidas({ itens }) {
  const r = resumirDespesas(itens);
  return (
    <section aria-label="Indicadores das despesas selecionadas" className="v2-grid">
      <div className="v2-card"><strong>Total efetivo</strong><p>{formatarMoeda(r.efetivas)}</p></div>
      <div className="v2-card"><strong>Quantidade</strong><p>{r.quantidade}</p></div>
      <div className="v2-card"><strong>Maior despesa efetiva</strong><p>{formatarMoeda(r.maior)}</p></div>
      <div className="v2-card"><strong>Média efetiva</strong><p>{formatarMoeda(r.media)}</p></div>
      <div className="v2-card">
        <strong>Adiantamentos ({r.quantidadeAdiantamentos})</strong>
        <p>Total concedido: {formatarMoeda(r.adiantado)}</p>
        <p>Valor recuperado: {formatarMoeda(r.recuperado)}</p>
        <p>Saldo a recuperar: {formatarMoeda(r.saldo)}</p>
      </div>
    </section>
  );
}

function Lista({ itens, caminhoes = [], motoristas = [], atualizar }) {
  const [apagando, setApagando] = useState("");
  const [erro, setErro] = useState("");
  const trava = useRef(false);
  async function excluir(i) {
    if (trava.current) return;
    if (!window.confirm((i.tipo === "motorista" ? "Remover da lista" : "Excluir definitivamente") + " a despesa “" + i.descricao + "” de " + formatarMoeda(i.valor) + "?")) return;
    trava.current = true;
    setApagando(i.chave);
    setErro("");
    try { await apagarDespesa(db, i); atualizar(); }
    catch (ex) { setErro(ex.message); }
    finally { trava.current = false; setApagando(""); }
  }
  if (!itens.length) return <p>Nenhuma despesa no período selecionado.</p>;
  return <>
    {erro && <p role="alert">{erro}</p>}
    <ul className="v2-grid v2-despesa-itens" style={{ padding:0, listStyle:"none" }}>
      {itens.map(i => <li className="v2-card" key={i.chave}>
        <strong>{i.descricao || "Despesa sem descrição"}</strong>
        <p>{formatarData(i.data)} · {vinculoNome(i, caminhoes, motoristas)}</p>
        <p>{formatarMoeda(i.valor)}</p>
        {i.adiantamento && <>
          <p>Adiantamento · {situacaoAdiantamento(i)}</p>
          <p>Recuperado: {formatarMoeda(i.recuperado)} · Saldo: {formatarMoeda(Number(i.valor) - Number(i.recuperado))}</p>
        </>}
        <div className="v2-actions">
          <Link to={urlEdicao(i)}>Editar {i.adiantamento ? "adiantamento" : "despesa"}</Link>
          <button type="button" disabled={Boolean(apagando)} onClick={() => excluir(i)}>{apagando === i.chave ? "Excluindo…" : "Excluir"}</button>
        </div>
      </li>)}
    </ul>
  </>;
}

export function DespesasV2() {
  const estado = useCarregamento();
  const [filtro, setFiltro] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [vinculo, setVinculo] = useState("");
  const itensTipo = filtrarDespesas(estado.itens, { tipo: filtro, vinculo });
  const vinculados = filtro === "caminhao" ? estado.caminhoes : estado.motoristas;
  const visiveis = filtrarDespesas(itensTipo, { semana: periodo });
  const semanas = [...new Map(itensTipo.map(i => [i.inicio + ":" + i.fim, i])).entries()]
    .sort((a, b) => b[0].localeCompare(a[0]));
  return <section className="v2-page">
    <h1>Despesas</h1>
    <p>Central de despesas e adiantamentos.</p>
    <div className="v2-actions"><Link to={CAMINHO}>+ Nova despesa</Link></div>
    <div className="v2-actions" aria-label="Filtrar vínculo">
      {TIPOS.map(t => <button type="button" key={t.valor} aria-pressed={filtro === t.valor} onClick={() => { setFiltro(t.valor); setPeriodo(""); setVinculo(""); }}>{t.nome}</button>)}
    </div>
    {estado.carregando ? <p role="status">Carregando despesas…</p> : estado.erro ? <p role="alert">{estado.erro}</p> : <>
      {(filtro === "caminhao" || filtro === "motorista") && <label className="v2-actions">
        {filtro === "caminhao" ? "Caminhão" : "Motorista"}
        <select value={vinculo} onChange={e => { setVinculo(e.target.value); setPeriodo(""); }}>
          <option value="">Todos</option>
          {vinculados.map(i => <option key={i.id} value={i.id}>{i.placa ?? i.nome}</option>)}
        </select>
      </label>}
      <label className="v2-actions">Semana
        <select aria-label="Semana" value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="">Todas as semanas</option>
          {semanas.map(([chave, i]) => <option key={chave} value={chave}>{formatarData(i.inicio)} a {formatarData(i.fim)}</option>)}
        </select>
      </label>
      <Medidas itens={visiveis} />
      <Lista {...estado} itens={visiveis} />
    </>}
  </section>;
}

export function ListaDespesasPerfilV2({ tipo, id, inicio, fim }) {
  const estado = useCarregamento(tipo, id);
  const visiveis = filtrarDespesas(estado.itens, { inicio, fim });
  return <section aria-label="Despesas do perfil">
    <div className="v2-actions"><Link to={CAMINHO + "?" + tipo + "=" + encodeURIComponent(id)}>+ Nova despesa</Link></div>
    {estado.carregando ? <p role="status">Carregando despesas…</p> : estado.erro ? <p role="alert">{estado.erro}</p> : <>
      <Medidas itens={visiveis} />
      <Lista {...estado} itens={visiveis} />
    </>}
  </section>;
}

function Editor({ original, vinculoInicial, tipoInicial, caminhoes, motoristas }) {
  const [form, setForm] = useState(() => original ? {
    ...INICIAL, tipo: original.tipo, vinculo: original.vinculo ?? "", data: original.data,
    descricao: original.descricao ?? "", valor: original.valor,
    adiantamento: original.adiantamento, recuperado: original.recuperado,
  } : { ...INICIAL, tipo: tipoInicial, vinculo: vinculoInicial ?? "" });
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");
  const trava = useRef(false);
  const identidade = useRef(null);
  const sugestao = form.tipo === "motorista" && !form.adiantamento && /\badiantamento\b/i.test(form.descricao);
  const opcoes = form.tipo === "caminhao" ? caminhoes : motoristas.filter(m => m.ativo || String(m.id) === String(form.vinculo));
  function set(campo, valor) { setForm(a => ({ ...a, [campo]: valor })); }
  async function salvar(evento) {
    evento.preventDefault();
    if (trava.current || salvo) return;
    trava.current = true;
    setSalvando(true);
    setErro("");
    try {
      if (!identidade.current) identidade.current = { id: Date.now(), chaveCliente: globalThis.crypto.randomUUID() };
      await salvarDespesa(db, form, original, identidade.current);
      setSalvo(true);
    }
    catch (ex) { setErro(ex.message); }
    finally { setSalvando(false); trava.current = false; }
  }
  return <section className="v2-page">
    <h1>{original ? "Editar despesa" : "Novo lançamento / Despesa"}</h1>
    {salvo ? <div className="v2-card">
      <p role="status">Despesa salva.</p>
      <div className="v2-actions">
        <Link to="/despesas">Ver Despesas</Link>
        {form.vinculo && <Link to={perfilUrl(form.tipo, form.vinculo)}>Voltar ao perfil</Link>}
        {!original && <button type="button" onClick={() => { setForm({ ...INICIAL, tipo: tipoInicial, vinculo: vinculoInicial ?? "" }); identidade.current = null; setSalvo(false); }}>Cadastrar outra despesa</button>}
      </div>
    </div> : <form className="v2-card v2-form" onSubmit={salvar}>
      <label>Vincular a
        <select value={form.tipo} disabled={Boolean(original)} onChange={e => setForm(a => ({ ...a, tipo: e.target.value, vinculo: "", adiantamento: false, recuperado: 0 }))}>
          <option value="empresa">Empresa</option><option value="caminhao">Caminhão</option><option value="motorista">Motorista</option>
        </select>
      </label>
      {form.tipo !== "empresa" && <label>{form.tipo === "caminhao" ? "Caminhão" : "Motorista"}
        <select value={form.vinculo} required disabled={Boolean(original)} onChange={e => set("vinculo", e.target.value)}>
          <option value="">Selecione</option>
          {opcoes.map(o => <option key={o.id} value={o.id}>{o.placa ? o.placa + " · " + o.modelo : o.nome}</option>)}
        </select>
      </label>}
      <label>Data<input type="date" required value={form.data} onChange={e => set("data", e.target.value)} /></label>
      <label>Descrição<input type="text" required value={form.descricao} onChange={e => set("descricao", e.target.value)} /></label>
      <label>Valor (R$)<input inputMode="decimal" required value={form.valor} onChange={e => set("valor", e.target.value)} /></label>
      {form.tipo === "motorista" && <>
        <label><input type="checkbox" checked={form.adiantamento} onChange={e => set("adiantamento", e.target.checked)} /> É um adiantamento?</label>
        {sugestao && <p>Se for um adiantamento, marque a opção acima.</p>}
        {form.adiantamento && <>
          <label>Valor recuperado (R$)<input inputMode="decimal" required value={form.recuperado} onChange={e => set("recuperado", e.target.value)} /></label>
          <div className="v2-actions">
            <button type="button" onClick={() => set("recuperado", 0)}>Marcar pendente</button>
            <button type="button" onClick={() => set("recuperado", form.valor)}>Quitar valor</button>
          </div>
          <p>Adiantamento não entra nas despesas operacionais nem é descontado automaticamente.</p>
        </>}
      </>}
      {erro && <p role="alert">{erro}</p>}
      <div className="v2-actions">
        <Link to="/despesas">Cancelar</Link>
        <button disabled={salvando}>{salvando ? "Salvando…" : "Salvar lançamento"}</button>
      </div>
    </form>}
  </section>;
}

export function FormularioDespesaV2() {
  const [q] = useSearchParams();
  const edicao = q.get("editar");
  const caminhao = idDespesa(q.get("caminhao"));
  const motorista = idDespesa(q.get("motorista"));
  const tipo = motorista ? "motorista" : caminhao ? "caminhao" : "empresa";
  const id = motorista ?? caminhao ?? "";
  const estado = useCarregamento(tipo, id, Boolean(edicao));
  if (estado.carregando) return <p role="status">Carregando formulário…</p>;
  if (estado.erro) return <p role="alert">{estado.erro}</p>;
  const original = edicao ? estado.itens.find(i => i.chave === edicao) : null;
  if (edicao && !original) return <p role="alert">Despesa não encontrada. <Link to="/despesas">Voltar</Link></p>;
  return <Editor key={q.toString()} original={original} tipoInicial={tipo} vinculoInicial={id}
    caminhoes={estado.caminhoes} motoristas={estado.motoristas} />;
}
