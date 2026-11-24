import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alocacaoEm, dadosViagemV2, diaISO, hojeLocal, motoristaDaViagem, periodoDoPerfil, semanasDaViagem, taxaEm } from '../src/v2/regras.js';

const joao = {id:1,nome:'Motorista fictício A',ativo:true,frota:'cm'};
const bia = {id:2,nome:'Motorista fictício B',ativo:true,frota:'cm'};
const parceiro = {id:3,nome:'Parceiro fictício',ativo:true,frota:'terceirizada',caminhao_origem_id:2};
const proprio = {id:1,placa:'ABC1D23',frota:'cm'};
const terceiro = {id:2,placa:'XYZ1A22',frota:'terceirizada'};
const taxas = [{frota:'cm',vigencia:'2026-11-23',percentual:12.5},{frota:'cm',vigencia:'2026-11-30',percentual:0},{frota:'terceirizada',vigencia:'2026-12-01',percentual:13}];
const formulario = {data:'2026-11-23',dataEntrega:'',nf:' NF-FICT-2 ',cte:' ',volFiscal:100,volEntregue:'150,20',taxa:'37,77'};

test('laço de data civil: transporte no domingo existente, semana nova de segunda a sábado, sobreposição protegida', () => {
  assert.ok(diaISO('2026-11-23'));
  assert.equal(diaISO('2026-11-31'),false);
  assert.equal(hojeLocal(new Date('2026-11-24T02:50:00Z')),'2026-11-23');
  assert.deepEqual(semanasDaViagem('2026-11-23',[]), {inicio:'2026-11-23',fim:'2026-11-28'});
  assert.throws(() => semanasDaViagem('2026-11-22',[]), /Domingo/);
  const legado = {id:9,inicio:'2026-11-16',fim:'2026-11-22'};
  assert.deepEqual(semanasDaViagem('2026-11-22',[legado]),{inicio:legado.inicio,fim:legado.fim});
  assert.throws(() => semanasDaViagem('2026-11-22',[legado,legado]), /sobrepostas/);
});

test('lançamento atrasado exige confirmação e preserva placa, viagem, taxa e data de transporte', () => {
  const base = {formulario,caminhao:proprio,motorista:bia,taxas,id:1795470000001,hoje:'2026-11-25'};
  assert.throws(() => dadosViagemV2(base), /atraso/);
  const viagem = dadosViagemV2({...base,confirmado:true});
  assert.equal(viagem.dataEntrega,formulario.data);
  assert.equal(viagem.percentualAplicado,12.5);
  assert.equal(viagem.taxa,37.77);
  assert.equal(viagem.volEntregue,150.2);
  assert.equal(viagem.nf,'NF-FICT-2');
  assert.equal(viagem.motoristaId,bia.id);
  assert.equal(viagem.motoristaNome,bia.nome);
  assert.equal(viagem.placaRegistrada,proprio.placa);
  assert.equal(viagem.frotaRegistrada,'cm');
  assert.throws(() => dadosViagemV2({...base,motorista:parceiro,confirmado:true}), /mesma frota/);
  assert.throws(() => dadosViagemV2({...base,formulario:{...formulario,dataEntrega:'2026-11-22'},confirmado:true}), /anteceder/);
});

test('alocação indefinida e saída não retroagem para uma viagem que já tem motorista', () => {
  const eventos = [
    {id:1,caminhao_id:1,motorista_id:1,inicio:'2026-11-23T12:00:00Z'},
    {id:2,caminhao_id:1,motorista_id:2,inicio:'2026-11-24T12:00:00Z'},
    {id:3,caminhao_id:1,motorista_id:null,inicio:'2026-11-25T12:00:00Z'},
  ];
  assert.equal(alocacaoEm(eventos,1,'2026-11-24T11:59:00Z').motorista_id,joao.id);
  assert.equal(alocacaoEm(eventos,1,'2026-11-24T12:00:00Z').motorista_id,bia.id);
  assert.equal(alocacaoEm(eventos,1,'2026-11-27T00:00:00Z').motorista_id,null);
  assert.equal(motoristaDaViagem({motoristaId:joao.id},proprio,[joao,bia]),joao);
  assert.equal(motoristaDaViagem({},proprio,[joao,bia]),null);
  assert.equal(motoristaDaViagem({},terceiro,[joao,bia,parceiro]),parceiro);
});

test('vigências são inclusivas pela data da viagem e aceitam zero sem trocar valores já gravados', () => {
  assert.equal(taxaEm(taxas,'cm','2026-11-22'),10);
  assert.equal(taxaEm(taxas,'cm','2026-11-23'),12.5);
  assert.equal(taxaEm(taxas,'cm','2026-11-30'),0);
  assert.equal(taxaEm(taxas,'terceirizada','2026-11-30'),11);
  assert.equal(taxaEm(taxas,'terceirizada','2026-12-01'),13);
});

test('atalhos de período no perfil não dependem do fuso do computador', () => {
  assert.deepEqual(periodoDoPerfil('semana','2026-11-23'),{inicio:'2026-11-23',fim:'2026-11-28'});
  assert.deepEqual(periodoDoPerfil('mes','2026-11-23'),{inicio:'2026-11-01',fim:'2026-11-30'});
});
