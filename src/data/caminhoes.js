import { db } from "../lib/supabase";

export const FROTA_CM = "cm";
export const FROTA_TERCEIRIZADA = "terceirizada";

export const FROTAS = [
  { tipo: FROTA_CM, titulo: "Frota C&M" },
  { tipo: FROTA_TERCEIRIZADA, titulo: "Frota Terceirizada" },
];

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
