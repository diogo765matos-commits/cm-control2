import { db, storage } from "../lib/supabase";

const BUCKET_DOCUMENTOS = "documentos-caminhoes";

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

// Envia uma foto/arquivo de documento (CNH, CRLV, etc.) para o Storage e
// adiciona o registro na lista de documentos do caminhão.
export async function adicionarDocumento(caminhaoId, documentosAtuais, nome, arquivo) {
  const extensao = (arquivo.name.split(".").pop() || "bin").toLowerCase();
  const nomeArquivo = `${caminhaoId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extensao}`;

  const url = await storage.upload(BUCKET_DOCUMENTOS, nomeArquivo, arquivo);

  const novoDocumento = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    nome,
    url,
    caminho: nomeArquivo,
    criadoEm: new Date().toISOString(),
  };

  const documentos = [...(documentosAtuais || []), novoDocumento];

  const [caminhao] = await db.update("caminhoes", `id=eq.${caminhaoId}`, {
    documentos,
  });

  return caminhao;
}

export async function excluirDocumento(caminhaoId, documentosAtuais, documentoId) {
  const documento = (documentosAtuais || []).find((d) => d.id === documentoId);

  if (documento?.caminho) {
    await storage.remove(BUCKET_DOCUMENTOS, documento.caminho);
  }

  const documentos = (documentosAtuais || []).filter(
    (d) => d.id !== documentoId
  );

  const [caminhao] = await db.update("caminhoes", `id=eq.${caminhaoId}`, {
    documentos,
  });

  return caminhao;
}
