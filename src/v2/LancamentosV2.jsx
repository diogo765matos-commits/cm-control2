import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useDadosV2 } from './useDadosV2';
import { adicionarViagemV2 } from './api';
import { alocacaoEm, dadosViagemV2, FROTAS_V2, hojeLocal, idDaNovaViagem, semanasDaViagem, taxaEm } from './regras';
import { getSemanasViagens } from '../data/viagens';

const nova = () => ({data:'', nf:'', cte:'', volFiscal:'100', volEntregue:'', dataEntrega:'', taxa:'37,77'});
const labelFrota = frota => frota === 'cm' ? 'C&M' : 'Terceirizada';
const mesmo = (a,b) => String(a) === String(b);

export function LancamentosV2() {
  return <div className="v2-page"><PageHeader titulo="Novo lançamento" subtitulo="Um cadastro, várias consultas." />
    <div className="v2-grid">
      <Link className="v2-card v2-option" to="/lancamentos/viagem"><h2>Cadastrar viagem</h2><p>Informe o caminhão e o motorista responsável.</p></Link>
      <Link className="v2-card v2-option" to="/lancamentos/despesa"><h2>Cadastrar despesa</h2><p>Vincule à empresa, ao caminhão ou ao motorista.</p></Link>
    </div>
  </div>;
}

export function FormularioViagemV2() {
  const [params] = useSearchParams();
  const dados = useDadosV2({comTaxas:true});
  const [caminhaoId,setCaminhaoId] = useState(params.get('caminhao') || '');
  const [motoristaSelecionado,setMotoristaSelecionado] = useState(params.get('motorista'));
  const [form,setForm] = useState(nova);
  const [entregaManual,setEntregaManual] = useState(false);
  const [confirmado,setConfirmado] = useState(false);
  const [status,setStatus] = useState({salvando:false, erro:'', concluido:''});
  const tentativa = useRef(null);
  const ocupado = useRef(false);
  const caminhoes = dados.caminhoes.filter(c=>FROTAS_V2.includes(c.frota));
  const caminhao = caminhoes.find(c=>mesmo(c.id,caminhaoId));
  const bagaco = dados.caminhoes.filter(c=>c.frota==='bagaco');
  const selecionadoBagaco = bagaco.find(c=>mesmo(c.id,caminhaoId));
  const atual = alocacaoEm(dados.alocacoes,caminhaoId);
  const candidatos = dados.motoristas.filter(m=>m.ativo && m.frota===caminhao?.frota);
  const deOrigem = candidatos.find(m=>mesmo(m.caminhao_origem_id,caminhaoId));
  const sugerido = atual ? candidatos.find(m=>mesmo(m.id,atual.motorista_id)) : deOrigem;
  const motoristaId = motoristaSelecionado != null ? motoristaSelecionado : sugerido?.id ?? '';
  const motorista = candidatos.find(m=>mesmo(m.id,motoristaId));
  const hoje = hojeLocal();
  const atrasada = !!form.data && form.data < hoje;
  const pronta = !dados.carregando && !dados.erro;
  const campo = (k,valor) => {
    if (k==='data') {
      setConfirmado(false);
      setForm(f=>({...f,data:valor,dataEntrega:entregaManual ? f.dataEntrega : valor}));
    } else {
      if (k==='dataEntrega') setEntregaManual(true);
      setForm(f=>({...f,[k]:valor}));
    }
  };
  useEffect(() => {
    if (!status.concluido) return;
    document.querySelector('#v2-viagem-confirmada')?.focus();
  },[status.concluido]);
  async function salvar(e) {
    e.preventDefault();
    if (ocupado.current || !pronta) return;
    ocupado.current = true;
    setStatus({salvando:true,erro:'',concluido:''});
    try {
      const id = tentativa.current ?? idDaNovaViagem();
      const viagem = dadosViagemV2({formulario:form,caminhao,motorista,taxas:dados.taxas,id,hoje,confirmado});
      const periodo = semanasDaViagem(viagem.data,await getSemanasViagens(caminhao.id));
      tentativa.current = id;
      await adicionarViagemV2(caminhao,periodo,viagem);
      tentativa.current = null;
      setStatus({salvando:false,erro:'',concluido:'Viagem NF ' + viagem.nf + ' cadastrada em ' + caminhao.placa + '.'});
      setForm(nova());setEntregaManual(false);setConfirmado(false);
    } catch (erro) {
      setStatus({salvando:false,erro:erro.message,concluido:''});
    } finally { ocupado.current = false; }
  }
  return <div className="v2-page"><PageHeader titulo="Novo lançamento / Viagem" />
    {dados.carregando && <p>Carregando opções…</p>}
    {(dados.erro || status.erro) && <p role="alert">{dados.erro || status.erro}</p>}
    {status.concluido && <p tabIndex={-1} id="v2-viagem-confirmada" role="status">{status.concluido} <Link to={'/caminhao/'+caminhaoId}>Ver caminhão</Link></p>}
    <form className="v2-card v2-form" onSubmit={salvar}>
      <label>Caminhão<select aria-label="Caminhão" disabled={!pronta || status.salvando} required value={caminhaoId} onChange={e=>{
        setCaminhaoId(e.target.value); setMotoristaSelecionado(params.get('motorista')); setConfirmado(false);
      }}><option value="">Selecione</option>
        {caminhoes.map(c=><option key={c.id} value={c.id}>{c.placa} · {c.modelo} · {labelFrota(c.frota)}</option>)}
        {bagaco.map(c=><option key={c.id} value={c.id}>{c.placa} · Bagaço de cana</option>)}
      </select></label>
      {selecionadoBagaco && <p>O cadastro de Bagaço permanece no formulário original. <Link to={'/caminhao/'+selecionadoBagaco.id}>Abrir caminhão</Link></p>}
      {!selecionadoBagaco && <>
      <p>Motorista atual: <strong>{sugerido?.nome ?? (atual ? 'Sem motorista ativo' : caminhao?.motorista ? caminhao.motorista + ' (legado, confirme)' : 'Sem motorista')}</strong></p>
      <label>Motorista responsável por esta viagem<select aria-label="Motorista responsável por esta viagem" required disabled={!caminhao || status.salvando} value={motorista?.id ?? ''} onChange={e=>{
        setMotoristaSelecionado(e.target.value);setConfirmado(false);
      }}><option value="">Selecione</option>{candidatos.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></label>
      <div className="v2-grid">
        <label>Nota fiscal<input required value={form.nf} onChange={e=>campo('nf',e.target.value)} /></label>
        <label>CT-e<input value={form.cte} onChange={e=>campo('cte',e.target.value)} /></label>
        <label>Data de transporte<input type="date" required value={form.data} onChange={e=>campo('data',e.target.value)} /></label>
        <label>Data de entrega<input type="date" min={form.data} value={form.dataEntrega} onChange={e=>campo('dataEntrega',e.target.value)} /></label>
        <label>Volume fiscal<input inputMode="decimal" value={form.volFiscal} onChange={e=>campo('volFiscal',e.target.value)} /></label>
        <label>Volume entregue<input required inputMode="decimal" value={form.volEntregue} onChange={e=>campo('volEntregue',e.target.value)} /></label>
        <label>Valor por volume (R$)<input required inputMode="decimal" value={form.taxa} onChange={e=>campo('taxa',e.target.value)} /></label>
      </div>
      {atrasada && <label><input required type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)} /> Confirmo que este motorista fez a viagem nesta data.</label>}
      {caminhao && form.data && <p>Percentual aplicado: {taxaEm(dados.taxas,caminhao.frota,form.data)}%</p>}
      <button disabled={!pronta || status.salvando}>{status.salvando ? 'Salvando…' : 'Salvar viagem'}</button></>}
    </form>
  </div>;
}
