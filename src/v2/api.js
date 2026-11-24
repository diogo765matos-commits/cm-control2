import { db } from '../lib/supabase.js';
import { FROTAS_V2, diaISO } from './regras.js';

async function consulta(tabela, params = {}) {
  const resultado = [];
  const limite = 200;
  for (let offset = 0; ; offset += limite) {
    const pagina = await db.select(tabela, new URLSearchParams({
      select:'*', ...params, limit:String(limite), offset:String(offset),
    }).toString());
    resultado.push(...pagina);
    if (pagina.length < limite) return resultado;
  }
}

export const carregarMotoristas = () => consulta('v2_motoristas', { order:'nome.asc,id.asc' });
export const carregarAlocacoes = () => consulta('v2_alocacoes', { order:'inicio.desc,id.desc' });
export const carregarTaxas = () => consulta('v2_taxas', { order:'vigencia.desc,id.desc' });

export async function criarMotorista({nome, frota}) {
  if (!FROTAS_V2.includes(frota) || !nome?.trim()) throw new Error('Preencha o nome e a frota.');
  return (await db.insert('v2_motoristas', {nome:nome.trim(), frota}))[0];
}

export async function atualizarMotorista(motorista, dados) {
  const nome = dados.nome?.trim();
  if (!nome) throw new Error('Preencha o nome.');
  return (await db.update('v2_motoristas', 'id=eq.' + motorista.id, {nome, ativo:!!dados.ativo}))[0];
}

export async function trocarMotorista(caminhao, motorista, inicio) {
  if (caminhao.frota !== 'cm' || (motorista && (!motorista.ativo || motorista.frota !== 'cm'))) {
    throw new Error('Selecione um caminhão C&M e um motorista ativo da própria frota.');
  }
  const registro = {caminhao_id:caminhao.id, motorista_id:motorista?.id ?? null};
  if (inicio) {
    const instante = new Date(inicio + '-03:00');
    if (!Number.isFinite(+instante) || +instante > Date.now()) throw new Error('Informe uma data e hora efetivas, sem agendamento futuro.');
    registro.inicio = instante.toISOString();
  }
  return (await db.insert('v2_alocacoes', registro))[0];
}

export async function gravarTaxa({frota, vigencia, percentual}) {
  const texto = String(percentual).trim().replace(',', '.');
  const taxa = Number(texto);
  if (!FROTAS_V2.includes(frota) || !diaISO(vigencia) || !/^\d{1,3}(\.\d{1,2})?$/.test(texto) || !Number.isFinite(taxa) || taxa < 0 || taxa > 100) {
    throw new Error('Informe frota, vigência e percentual entre 0 e 100.');
  }
  return (await db.insert('v2_taxas', {frota, vigencia, percentual:taxa}))[0];
}

export async function adicionarViagemV2(caminhao, periodo, viagem) {
  const resultado = await db.rpc('v2_adicionar_viagem', {
    p_caminhao_id:caminhao.id, p_inicio:periodo.inicio, p_fim:periodo.fim, p_viagem:viagem,
  });
  const semana = Array.isArray(resultado) ? resultado[0] : resultado;
  if (!semana?.id) throw new Error('Não foi possível confirmar o lançamento. Confira a lista antes de repetir.');
  return semana;
}
