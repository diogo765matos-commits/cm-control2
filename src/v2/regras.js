export const FROTAS_V2 = ['cm', 'terceirizada'];

export function diaISO(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor ?? '')) return false;
  const t = new Date(valor + 'T00:00:00Z');
  return !Number.isNaN(+t) && t.toISOString().slice(0, 10) === valor;
}

export function hojeLocal(agora = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/Sao_Paulo'}).format(agora);
}

export function semanasDaViagem(data, semanas) {
  if (!diaISO(data)) throw new Error('Informe a data de transporte.');
  const encontradas = semanas.filter(s => s.inicio <= data && s.fim >= data);
  if (encontradas.length > 1) throw new Error('Existem semanas sobrepostas. Confira o período no caminhão antes de cadastrar.');
  if (encontradas.length) return { inicio: encontradas[0].inicio, fim: encontradas[0].fim };
  const inicio = new Date(data + 'T00:00:00Z');
  const dia = inicio.getUTCDay();
  if (!dia) throw new Error('Domingo não pertence à semana de segunda a sábado. Confirme o período existente do caminhão.');
  inicio.setUTCDate(inicio.getUTCDate() - dia + 1);
  const fim = new Date(inicio);
  fim.setUTCDate(fim.getUTCDate() + 5);
  return { inicio: inicio.toISOString().slice(0,10), fim: fim.toISOString().slice(0,10) };
}

export function taxaEm(taxas, frota, data) {
  const vigentes = taxas.filter(t => t.frota === frota && t.vigencia <= data);
  const taxa = vigentes.reduce((maisRecente, item) =>
    !maisRecente || item.vigencia > maisRecente.vigencia ? item : maisRecente, null);
  return taxa ? Number(taxa.percentual) : frota === 'terceirizada' ? 11 : 10;
}

export function alocacaoEm(alocacoes, caminhaoId, instante = new Date().toISOString()) {
  const limite = Date.parse(instante);
  return alocacoes.filter(a => String(a.caminhao_id) === String(caminhaoId) &&
    Date.parse(a.inicio) <= limite)
    .reduce((maisRecente, item) => !maisRecente || Date.parse(item.inicio) > Date.parse(maisRecente.inicio) ||
      (Date.parse(item.inicio) === Date.parse(maisRecente.inicio) && Number(item.id) > Number(maisRecente.id))
      ? item : maisRecente, null);
}

export function motoristaDaViagem(viagem, caminhao, motoristas) {
  if (viagem.motoristaId != null) {
    return motoristas.find(m => String(m.id) === String(viagem.motoristaId)) ?? null;
  }
  if (caminhao.frota !== 'terceirizada') return null;
  return motoristas.find(m => m.frota === 'terceirizada' && String(m.caminhao_origem_id) === String(caminhao.id)) ?? null;
}

export function numeroFormulario(valor, nome, { opcional = false, minimo = 0, maior = false } = {}) {
  if (valor == null || String(valor).trim() === '') {
    if (opcional) return '';
    throw new Error('Preencha ' + nome + '.');
  }
  const numero = Number(String(valor).trim().replace(',', '.'));
  if (!Number.isFinite(numero) || numero < minimo || (maior && numero === minimo)) {
    throw new Error('Confira ' + nome + '.');
  }
  return numero;
}

export function dadosViagemV2({ formulario, caminhao, motorista, taxas, id, hoje, confirmado }) {
  if (!caminhao || !FROTAS_V2.includes(caminhao.frota) || !motorista?.ativo ||
      motorista.frota !== caminhao.frota) {
    throw new Error('Selecione o caminhão e um motorista ativo da mesma frota.');
  }
  const data = formulario.data;
  const entrega = formulario.dataEntrega || data;
  if (!diaISO(data) || !diaISO(entrega)) throw new Error('Informe datas válidas.');
  if (entrega < data) throw new Error('A data de entrega não pode anteceder o transporte.');
  if (data < hoje && !confirmado) throw new Error('Confirme o motorista desta viagem lançada com atraso.');
  if (!formulario.nf?.trim()) throw new Error('Preencha a nota fiscal.');
  const percentualAplicado = taxaEm(taxas, caminhao.frota, data);
  if (!Number.isFinite(percentualAplicado) || percentualAplicado < 0 || percentualAplicado > 100) {
    throw new Error('Percentual inválido para a data de transporte.');
  }
  return {
    id, data, nf: formulario.nf.trim(), cte: formulario.cte?.trim() || '',
    volFiscal: numeroFormulario(formulario.volFiscal, 'o volume fiscal', { opcional: true }),
    volEntregue: numeroFormulario(formulario.volEntregue, 'o volume entregue', { maior: true }),
    dataEntrega: entrega,
    taxa: numeroFormulario(formulario.taxa, 'o valor por volume', { maior: true }),
    caminhaoId: Number(caminhao.id), placaRegistrada: caminhao.placa,
    frotaRegistrada: caminhao.frota, motoristaId: Number(motorista.id),
    motoristaNome: motorista.nome, percentualAplicado,
  };
}

export function idDaNovaViagem() { return Date.now(); }

export function periodoDoPerfil(tipo, hoje = hojeLocal()) {
  const inicio = new Date(hoje + 'T00:00:00Z');
  if (tipo === 'semana') inicio.setUTCDate(inicio.getUTCDate() - ((inicio.getUTCDay() + 6) % 7));
  else if (tipo === 'mes') inicio.setUTCDate(1);
  else return {inicio:'',fim:''};
  const fim = new Date(inicio);
  if (tipo === 'semana') fim.setUTCDate(fim.getUTCDate() + 5);
  else fim.setUTCMonth(fim.getUTCMonth()+1, 0);
  return {inicio:inicio.toISOString().slice(0,10),fim:fim.toISOString().slice(0,10)};
}
