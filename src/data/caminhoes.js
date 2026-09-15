import { db } from "../lib/supabase";
import {
  VALOR_POR_VOLUME,
  VALOR_POR_VOLUME_ANTIGO,
  VALOR_POR_TONELADA_BAGACO,
} from "./config";

export const FROTA_CM = "cm";
export const FROTA_TERCEIRIZADA = "terceirizada";
export const FROTA_BAGACO = "bagaco";

export const FROTAS = [
  { tipo: FROTA_CM, titulo: "Frota C&M" },
  { tipo: FROTA_TERCEIRIZADA, titulo: "Frota Terceirizada" },
  { tipo: FROTA_BAGACO, titulo: "Frota de Bagaço de Cana" },
];

// Taxa (R$ por unidade entregue) usada em cada frota. A Frota Bagaço de
// Cana usa tonelada como unidade em vez de volume (m³).
const TAXA_POR_FROTA = {
  [FROTA_CM]: VALOR_POR_VOLUME,
  [FROTA_TERCEIRIZADA]: VALOR_POR_VOLUME,
  [FROTA_BAGACO]: VALOR_POR_TONELADA_BAGACO,
};

export function taxaDaFrota(frota) {
  return TAXA_POR_FROTA[frota] ?? VALOR_POR_VOLUME;
}

// Taxa que estava em vigor antes do reajuste de 34,80 para 36,00
// (14/09/2026). Não muda mais — serve só de padrão para viagens antigas que
// foram salvas sem uma taxa própria, pra elas continuarem valendo o preço
// de quando foram lançadas, mesmo depois de reajustes futuros.
const TAXA_LEGADA_POR_FROTA = {
  [FROTA_CM]: VALOR_POR_VOLUME_ANTIGO,
  [FROTA_TERCEIRIZADA]: VALOR_POR_VOLUME_ANTIGO,
  [FROTA_BAGACO]: VALOR_POR_TONELADA_BAGACO, // essa nunca mudou
};

export function taxaLegadaDaFrota(frota) {
  return TAXA_LEGADA_POR_FROTA[frota] ?? VALOR_POR_VOLUME_ANTIGO;
}

// Resolve a taxa de verdade a usar pra calcular o valor de uma viagem: usa
// a taxa que ficou salva na própria viagem (gravada no momento em que ela
// foi cadastrada); se a viagem for antiga e não tiver essa taxa salva, cai
// pra taxa legada da frota — nunca pra taxa atual, senão viagens antigas
// mudariam de valor sempre que o preço for reajustado.
export function taxaEfetivaViagem(viagem, frota) {
  const salva = Number(viagem?.taxa);

  if (salva && !Number.isNaN(salva)) {
    return salva;
  }

  return taxaLegadaDaFrota(frota);
}

export function ehFrotaBagaco(frota) {
  return frota === FROTA_BAGACO;
}

// Rótulos de unidade: a Frota Bagaço de Cana usa "Tonelada" no lugar de
// "Volume" em todos os textos e relatórios.
export function unidadeDaFrota(frota) {
  const bagaco = ehFrotaBagaco(frota);

  return {
    rotulo: bagaco ? "Tonelada" : "Volume",
    abreviado: bagaco ? "Ton." : "Vol.",
    curta: bagaco ? "ton" : "m³",
  };
}

export async function getCaminhoes() {
  return db.select("caminhoes", "select=*&order=id.asc");
}

export async function criarCaminhao({ modelo, placa, motorista }, frota) {
  const [caminhao] = await db.insert("caminhoes", {
    modelo,
    placa: placa.toUpperCase(),
    motorista,
    frota,
  });

  return caminhao;
}

export async function atualizarCaminhao(id, dados) {
  const [caminhao] = await db.update("caminhoes", `id=eq.${id}`, dados);
  return caminhao;
}

export async function excluirCaminhao(id) {
  await db.remove("caminhoes", `id=eq.${id}`);
}
