import { db } from "../lib/supabase";
import { VALOR_POR_VOLUME, VALOR_POR_TONELADA_BAGACO } from "./config";

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
