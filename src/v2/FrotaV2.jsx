import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { criarMotorista, atualizarMotorista, gravarTaxa, trocarMotorista } from './api';
import { alocacaoEm, hojeLocal, motoristaDaViagem, periodoDoPerfil, taxaEm } from './regras';
import { taxaEfetivaViagem } from '../data/caminhoes';
import { getSemanasViagens } from '../data/viagens';
import { converterNumero, formatarData, formatarMoeda, formatarNumero } from '../utils/formatadores';
import { repartirReceita } from '../utils/receitaEmpresa';
import { ListaDespesasPerfilV2 } from './DespesasV2';
import { useDadosV2 } from './useDadosV2';
import PageHeader from '../components/PageHeader';

const frotas = { cm: 'Frota C&M', terceirizada: 'Frota terceirizada' };
const mesmo = (valor, alvo) => String(valor) === String(alvo);
const dataHora = iso => new Date(iso).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo' });


export function MotoristasFrotaV2({ frota, gerenciamento }) {
  const dados = useDadosV2({ comCaminhoes: true });
  const [editando, setEditando] = useState(null);
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const motoristas = dados.motoristas.filter(m => m.frota === frota);
  const apresentar = motorista => {
    setEditando(motorista ?? 'novo');
    setNome(motorista?.nome ?? '');
    setAtivo(motorista?.ativo ?? true);
    setErro('');
  };
  async function salvar(e) {
    e.preventDefault();
    setSalvando(true); setErro('');
    try {
      if (editando === 'novo') await criarMotorista({nome, frota});
      else await atualizarMotorista(editando, {nome, ativo});
      setEditando(null);
      dados.atualizar();
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  }
  return <section className="v2-card" aria-label="Motoristas">
    <div className="v2-actions"><h2>Motoristas</h2>
      <button onClick={() => apresentar()}>Cadastrar motorista</button>
    </div>
    {(erro || dados.erro) && <p role="alert">{erro || dados.erro}</p>}
    {editando && <form className="v2-form" onSubmit={salvar}>
      <label>Nome<input required value={nome} onChange={e => setNome(e.target.value)} /></label>
      {editando !== 'novo' && <label><input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Cadastro ativo</label>}
      <div className="v2-actions"><button disabled={salvando}>Salvar motorista</button><button type="button" disabled={salvando} onClick={() => setEditando(null)}>Cancelar</button></div>
    </form>}
    {dados.carregando && <p>Carregando motoristas…</p>}
    {!dados.carregando && !dados.erro && !motoristas.length && <p>Nenhum motorista cadastrado nesta frota.</p>}
    <div className="v2-grid">
      {motoristas.filter(m => gerenciamento || m.ativo).map(m => {
        const veiculos = dados.caminhoes.filter(c => c.frota === frota &&
          (mesmo(alocacaoEm(dados.alocacoes,c.id)?.motorista_id,m.id) ||
           (frota === 'terceirizada' && mesmo(m.caminhao_origem_id,c.id))));
        return <article className="v2-card" key={m.id}><h3>{m.nome}</h3>
          <p>{veiculos.length ? veiculos.map(c => c.placa).join(', ') : 'Sem caminhão vinculado'}{m.ativo ? '' : ' · Inativo'}</p>
          <div className="v2-actions"><Link to={'/frota/motorista/' + m.id}>Abrir perfil</Link>
            {gerenciamento && <button onClick={() => apresentar(m)}>Editar cadastro</button>}</div>
        </article>;
      })}
    </div>
  </section>;
}

export function HistoricoAlocacaoV2({ lista, motoristas, caminhoes, contexto }) {
  if (!lista?.length) return <p>Nenhuma alocação registrada.</p>;
  const porId = (dados, id) => dados.find(d => mesmo(d.id,id));
  return <ul className="v2-lista">{lista.map(a => <li key={a.id}>
    <time dateTime={a.inicio}>{dataHora(a.inicio)}</time>
    {contexto !== 'caminhao' && <span>{porId(caminhoes,a.caminhao_id)?.placa ?? 'Caminhão'}</span>}
    {contexto !== 'motorista' && <strong>{porId(motoristas,a.motorista_id)?.nome ?? 'Sem motorista'}</strong>}
  </li>)}</ul>;
}

function FormularioAlocacao({ caminhao, dados, atual, nome }) {
  const [motoristaId, setMotoristaId] = useState(atual?.motorista_id ?? '');
  const [inicio, setInicio] = useState('');
  const [status, setStatus] = useState({erro:'', salvando:false, concluido:false});
  const historico = dados.alocacoes.filter(a => mesmo(a.caminhao_id,caminhao.id));
  const candidatos = dados.motoristas.filter(m => m.frota === 'cm' && m.ativo);
  async function salvar(e) {
    e.preventDefault();
    setStatus({erro:'', salvando:true, concluido:false});
    try {
      const escolhido = candidatos.find(m => mesmo(m.id,motoristaId));
      if (motoristaId && !escolhido) throw new Error('Escolha um motorista ativo.');
      if (!inicio && atual && mesmo(atual.motorista_id ?? '', motoristaId)) throw new Error('Este já é o motorista atual.');
      await trocarMotorista(caminhao, escolhido, inicio);
      dados.atualizar();
      setInicio('');
      setStatus({erro:'', salvando:false, concluido:true});
    } catch (e) { setStatus({erro:e.message, salvando:false, concluido:false}); }
  }
  return <article className="v2-card">
    <h2>{caminhao.placa} · {caminhao.modelo}</h2>
    <p>Motorista atual: <strong>{nome}</strong></p>
    <form className="v2-form" onSubmit={salvar}>
      <label>Novo motorista<select value={motoristaId} onChange={e => setMotoristaId(e.target.value)}><option value="">Sem motorista</option>
        {candidatos.map(m => <option value={m.id} key={m.id}>{m.nome}</option>)}
      </select></label>
      <label>Troca anterior, se necessário (horário de Brasília)<input type="datetime-local" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
      <button disabled={status.salvando}>Registrar troca</button>
      {status.erro && <p role="alert">{status.erro}</p>}
      {status.concluido && <p role="status">Troca registrada.</p>}
    </form>
    <details><summary>Histórico de trocas</summary><HistoricoAlocacaoV2 lista={historico} motoristas={dados.motoristas} caminhoes={dados.caminhoes} contexto="caminhao" /></details>
  </article>;
}

export function AlocacoesV2() {
  const dados = useDadosV2();
  return <div className="v2-page">
    <PageHeader titulo="Alocação de motoristas" subtitulo="A frota C&M pode trocar o motorista atual sem alterar nenhuma viagem." />
    {dados.carregando && <p>Carregando alocações…</p>}{dados.erro && <p role="alert">{dados.erro}</p>}
    <div className="v2-grid">{dados.caminhoes.filter(c => c.frota === 'cm').map(c => {
      const atual = alocacaoEm(dados.alocacoes,c.id);
      const motorista = dados.motoristas.find(m => mesmo(m.id,atual?.motorista_id));
      return <FormularioAlocacao key={c.id} caminhao={c} dados={dados} atual={atual}
        nome={motorista?.nome ?? (atual ? 'Sem motorista' : c.motorista ? c.motorista + ' (cadastro legado, confirme)' : 'Sem motorista')} />;
    })}</div>
  </div>;
}

export function TaxasV2() {
  const [frota,setFrota] = useState('cm');
  const [vigencia,setVigencia] = useState(hojeLocal);
  const [percentual,setPercentual] = useState('');
  const [erro,setErro] = useState('');
  const [salvando,setSalvando] = useState(false);
  const dados = useDadosV2({ comTaxas:true, comCaminhoes:false });
  async function salvar(e) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      await gravarTaxa({frota,vigencia,percentual});
      setPercentual('');
      dados.atualizar();
    } catch (e) { setErro(e.message); }
    finally { setSalvando(false); }
  }
  const atualTer = taxaEm(dados.taxas,'terceirizada',hojeLocal());
  return <div className="v2-page">
    <PageHeader titulo="Taxas e comissões" subtitulo="As alterações valem para novas viagens conforme a data de transporte e não mudam os percentuais já gravados." />
    {dados.erro && <p role="alert">{dados.erro}</p>}{dados.carregando && <p>Carregando taxas…</p>}
    {!dados.carregando && !dados.erro && <><div className="v2-grid"><article className="v2-card">
      <h2>Frota C&M</h2><p>Comissão motorista: {taxaEm(dados.taxas,'cm',hojeLocal())}%</p></article>
      <article className="v2-card"><h2>Terceirizada</h2><p>Taxa C&M: {atualTer}% · Repasse bruto: {100-atualTer}%</p></article></div>
    <form className="v2-card v2-form" onSubmit={salvar}>
      <h2>Nova taxa com vigência</h2><label>Frota<select value={frota} onChange={e => setFrota(e.target.value)}>{Object.entries(frotas).map(([k,n]) => <option key={k} value={k}>{n}</option>)}</select></label>
      <label>Percentual (%)<input required inputMode="decimal" value={percentual} onChange={e => setPercentual(e.target.value)} /></label>
      <label>Vigência<input type="date" required value={vigencia} onChange={e => setVigencia(e.target.value)} /></label>
      <button disabled={salvando}>Salvar taxa</button>
      {erro && <p role="alert">{erro}</p>}
    </form>
    <div className="v2-card"><h2>Histórico de taxas</h2>
      <ul className="v2-lista"><li>Percentuais anteriores à primeira vigência: C&M 10% e Terceirizada 11%.</li>
        {dados.taxas.map(t => <li key={t.id}>{formatarData(t.vigencia)} · {frotas[t.frota]} · {t.percentual}%</li>)}
      </ul></div></>}
    <p>Frete por volume permanece gravado em cada viagem. Bagaço de cana não é alterado.</p>
  </div>;
}

export function PerfilMotoristaV2() {
  const {id} = useParams();
  const dados = useDadosV2();
  const [aba,setAba] = useState('viagens');
  const [inicio,setInicio] = useState('');
  const [fim,setFim] = useState('');
  const [estadoViagens,setEstadoViagens] = useState({ lista:[], erro:'', carregando:true });
  useEffect(() => {
    if (dados.carregando || dados.erro) return;
    let ativo = true;
    const motorista = dados.motoristas.find(m => mesmo(m.id,id));
    const caminhoes = dados.caminhoes.filter(c => c.frota !== 'bagaco' && (motorista?.frota === 'cm' ? c.frota === 'cm' : c.frota === 'terceirizada'));
    Promise.all(caminhoes.map(c => getSemanasViagens(c.id).then(semanas => semanas.flatMap(s => s.viagens.map(v => ({v,c,s}))))))
      .then(lista => { if (ativo) setEstadoViagens({lista:lista.flat(), erro:'', carregando:false}); })
      .catch(erro => { if (ativo) setEstadoViagens({lista:[], erro:erro.message, carregando:false}); });
    return () => { ativo = false; };
  }, [dados.caminhoes,dados.motoristas,dados.carregando,dados.erro,id]);
  if (dados.carregando) return <p>Carregando perfil…</p>;
  if (dados.erro) return <p role="alert">{dados.erro}</p>;
  const motorista = dados.motoristas.find(m => mesmo(m.id,id));
  if (!motorista) return <p>Motorista não encontrado.</p>;
  const alocadas = dados.caminhoes.filter(c => mesmo(alocacaoEm(dados.alocacoes,c.id)?.motorista_id,id) || mesmo(motorista.caminhao_origem_id,c.id));
  const viagens = estadoViagens.lista.filter(({v,c}) => {
    const data = v.data || v.dataEntrega;
    return mesmo(motoristaDaViagem(v,c,dados.motoristas)?.id,id) && (!inicio || data >= inicio) && (!fim || data <= fim);
  }).sort((a,b) => String(b.v.data).localeCompare(String(a.v.data)));
  const totais = viagens.reduce((a,{v,c}) => {
    const bruto = taxaEfetivaViagem(v,c.frota) * (converterNumero(v.volEntregue) || 0);
    const divisao = repartirReceita(bruto,c.frota,v);
    return [a[0]+(converterNumero(v.volFiscal) || 0),a[1]+(converterNumero(v.volEntregue) || 0),a[2]+bruto,
      a[3]+divisao.pagamentoMotoristas+divisao.participacaoCaminhoneiros];
  },[0,0,0,0]);
  return <div className="v2-page"><PageHeader titulo={motorista.nome} subtitulo={alocadas.length ? 'Caminhão atual: ' + alocadas.map(c=>c.placa).join(', ') : 'Sem alocação atual'} />
    <div className="v2-actions">
      {['viagens','despesas','alocações'].map(k => <button type="button" key={k} aria-pressed={aba===k} onClick={() => setAba(k)}>{k[0].toUpperCase()+k.slice(1)}</button>)}
      <Link to={'/lancamentos/viagem?motorista='+id}>Nova viagem</Link>
      <Link to={'/lancamentos/despesa?motorista='+id}>Nova despesa</Link>
    </div>
    <div className="v2-card v2-actions">
      {['semana','mes'].map(tipo => <button type="button" key={tipo} onClick={()=>{
        const periodo = periodoDoPerfil(tipo);setInicio(periodo.inicio);setFim(periodo.fim);
      }}>{tipo === 'semana' ? 'Esta semana' : 'Este mês'}</button>)}
      <label>De <input type="date" value={inicio} onChange={e=>setInicio(e.target.value)} /></label>
      <label>Até <input type="date" value={fim} onChange={e=>setFim(e.target.value)} /></label>
      <button onClick={()=>{setInicio('');setFim('');}}>Limpar período</button></div>
    {aba === 'viagens' && <div className="v2-card">
      {estadoViagens.carregando && <p>Carregando viagens…</p>}{estadoViagens.erro && <p role="alert">{estadoViagens.erro}</p>}
      <p>{viagens.length} viagens · {formatarNumero(totais[0])} m³ fiscal · {formatarNumero(totais[1])} m³ entregue</p>
      <p>Bruto {formatarMoeda(totais[2])} · {motorista.frota === 'cm' ? 'Comissão' : 'Repasse bruto'} {formatarMoeda(totais[3])}</p>
      <div className="v2-table"><table><thead><tr>{['NF','CT-e','Transporte','Entrega','Placa','Vol. fiscal','Vol. entregue','Frete/m³','Bruto'].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{viagens.map(({v,c,s}) => <tr key={s.id+':'+v.id}>
          <td>{v.nf}</td><td>{v.cte||'–'}</td><td>{formatarData(v.data)}</td><td>{formatarData(v.dataEntrega)}</td><td><Link to={'/caminhao/'+c.id}>{v.placaRegistrada || c.placa}</Link></td>
          <td>{formatarNumero(v.volFiscal)}</td><td>{formatarNumero(v.volEntregue)}</td><td>{formatarMoeda(taxaEfetivaViagem(v,c.frota))}</td><td>{formatarMoeda(taxaEfetivaViagem(v,c.frota)*(converterNumero(v.volEntregue) || 0))}</td>
        </tr>)}</tbody></table></div>
    </div>}
    {aba === 'despesas' && <ListaDespesasPerfilV2 tipo="motorista" id={id} inicio={inicio} fim={fim} />}
    {aba === 'alocações' && <div className="v2-card"><HistoricoAlocacaoV2 lista={dados.alocacoes.filter(a=>mesmo(a.motorista_id,id) && (!inicio || a.inicio.slice(0,10)>=inicio) && (!fim || a.inicio.slice(0,10)<=fim))} caminhoes={dados.caminhoes} motoristas={dados.motoristas} contexto="motorista" /></div>}
  </div>;
}

export function AlocacoesCaminhaoV2({caminhao}) {
  const dados = useDadosV2({comCaminhoes:false});
  const alocacao = alocacaoEm(dados.alocacoes,caminhao.id);
  const motorista = dados.motoristas.find(m => mesmo(alocacao?.motorista_id,m.id) ||
    (caminhao.frota === 'terceirizada' && mesmo(m.caminhao_origem_id,caminhao.id)));
  return <div className="v2-card"><h3>Motorista atual</h3>
    {dados.carregando ? <p>Carregando…</p> : dados.erro ? <p role="alert">{dados.erro}</p> :
      <><p>{motorista ? <Link to={'/frota/motorista/'+motorista.id}>{motorista.nome}</Link> : alocacao ? 'Sem motorista' : caminhao.motorista || 'Sem motorista'}</p>
      <details><summary>Histórico de alocações</summary><HistoricoAlocacaoV2 lista={dados.alocacoes.filter(a=>mesmo(a.caminhao_id,caminhao.id))} motoristas={dados.motoristas} caminhoes={[]} contexto="caminhao" /></details></>}
  </div>;
}
