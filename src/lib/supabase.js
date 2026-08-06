// Cliente Supabase "na mão", usando fetch nativo — não precisa instalar
// nenhum pacote novo (@supabase/supabase-js), então `npm install` continua
// funcionando exatamente como antes.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const CHAVE_SESSAO = "cm-control-auth";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configurados. " +
      "Crie um arquivo .env.local com essas variáveis (veja .env.local.example)."
  );
}

function lerSessao() {
  const bruto = localStorage.getItem(CHAVE_SESSAO);

  if (!bruto) return null;

  try {
    return JSON.parse(bruto);
  } catch {
    return null;
  }
}

function limparSessaoEExpirar() {
  localStorage.removeItem(CHAVE_SESSAO);
  window.location.reload();
}

async function request(caminho, options = {}) {
  const sessao = lerSessao();
  const token = sessao?.access_token || SUPABASE_ANON_KEY;

  const resposta = await fetch(`${SUPABASE_URL}${caminho}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (resposta.status === 401) {
    limparSessaoEExpirar();
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (!resposta.ok) {
    const texto = await resposta.text();
    let mensagem = texto;

    try {
      const json = JSON.parse(texto);
      mensagem = json.message || json.error_description || texto;
    } catch {
      // texto puro mesmo
    }

    throw new Error(mensagem || `Erro ${resposta.status}`);
  }

  if (resposta.status === 204) return null;

  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : null;
}

export const db = {
  select(tabela, query = "select=*") {
    return request(`/rest/v1/${tabela}?${query}`);
  },

  insert(tabela, dados) {
    return request(`/rest/v1/${tabela}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(dados),
    });
  },

  update(tabela, filtro, dados) {
    return request(`/rest/v1/${tabela}?${filtro}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(dados),
    });
  },

  remove(tabela, filtro) {
    return request(`/rest/v1/${tabela}?${filtro}`, {
      method: "DELETE",
    });
  },
};

export const auth = {
  async login(email, senha) {
    const resposta = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password: senha }),
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      const mensagem =
        dados.error_description || dados.msg || "E-mail ou senha inválidos.";
      throw new Error(mensagem);
    }

    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
    return dados;
  },

  async cadastrar(email, senha) {
    const resposta = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password: senha }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      const mensagem =
        dados.error_description || dados.msg || "Não foi possível criar a conta.";
      throw new Error(mensagem);
    }

    // Se a confirmação por e-mail estiver desligada no Supabase, o
    // cadastro já vem com sessão (access_token) e a pessoa entra direto.
    // Se estiver ligada, não vem access_token — precisa confirmar o e-mail.
    if (dados.access_token) {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
    }

    return dados;
  },

  logout() {
    localStorage.removeItem(CHAVE_SESSAO);
  },

  sessaoAtual() {
    return lerSessao();
  },
};
