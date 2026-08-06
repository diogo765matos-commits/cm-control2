const STORAGE_KEY = "caminhoes";

export const FROTA_CM = "cm";
export const FROTA_TERCEIRIZADA = "terceirizada";

export const FROTAS = [
  { tipo: FROTA_CM, titulo: "Frota C&M" },
  { tipo: FROTA_TERCEIRIZADA, titulo: "Frota Terceirizada" },
];

const CAMINHOES_PADRAO = [
  {
    id: 1,
    modelo: "Volvo FH 540",
    placa: "ABC1D23",
    motorista: "João Silva",
    frota: FROTA_CM,
  },
  {
    id: 2,
    modelo: "Scania R450",
    placa: "XYZ4F85",
    motorista: "Pedro Santos",
    frota: FROTA_CM,
  },
];

export function getCaminhoes() {
  const salvos = localStorage.getItem(STORAGE_KEY);
  const caminhoes = salvos ? JSON.parse(salvos) : CAMINHOES_PADRAO;

  // Caminhões salvos antes da separação por frota não tinham esse campo.
  return caminhoes.map((caminhao) => ({
    frota: FROTA_CM,
    ...caminhao,
  }));
}

export function salvarCaminhoes(caminhoes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(caminhoes));
}
