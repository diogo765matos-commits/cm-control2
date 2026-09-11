import { db } from "../lib/supabase";

// Lançamentos de ICMS a pagar, um por CT-e. Usado na aba "ICMS a Pagar"
// dentro de cada caminhão da Frota Terceirizada.

export async function getIcms(caminhaoId) {
  return db.select(
    "icms_registros",
    `caminhao_id=eq.${caminhaoId}&select=*&order=data.desc`
  );
}

export async function adicionarIcms(caminhaoId, { data, valor, cte }) {
  const [registro] = await db.insert("icms_registros", {
    caminhao_id: caminhaoId,
    data,
    valor,
    cte,
  });

  return registro;
}

export async function excluirIcms(id) {
  await db.remove("icms_registros", `id=eq.${id}`);
}
