const STORAGE_KEY = "caminhoes";

const CAMINHOES_PADRAO = [
  {
    id: 1,
    modelo: "Volvo FH 540",
    placa: "ABC1D23",
    motorista: "João Silva",
  },
  {
    id: 2,
    modelo: "Scania R450",
    placa: "XYZ4F85",
    motorista: "Pedro Santos",
  },
];

export function getCaminhoes() {
  const salvos = localStorage.getItem(STORAGE_KEY);
  return salvos ? JSON.parse(salvos) : CAMINHOES_PADRAO;
}

export function salvarCaminhoes(caminhoes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(caminhoes));
}
