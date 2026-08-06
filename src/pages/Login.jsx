import { useState } from "react";
import { auth } from "../lib/supabase";

function Login({ onLogin }) {
  const [modo, setModo] = useState("entrar"); // "entrar" | "cadastrar"

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);

  function trocarModo(novoModo) {
    setModo(novoModo);
    setErro("");
    setAviso("");
  }

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setCarregando(true);

    try {
      if (modo === "entrar") {
        await auth.login(email, senha);
        onLogin();
      } else {
        const resultado = await auth.cadastrar(email, senha);

        if (resultado.access_token) {
          onLogin();
        } else {
          setAviso(
            "Conta criada! Verifique seu e-mail para confirmar antes de entrar."
          );
          setModo("entrar");
        }
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={estiloTela}>
      <form style={estiloCard} onSubmit={enviar}>
        <h1 style={{ marginBottom: "6px" }}>🚛 C&M Control</h1>

        <p style={{ color: "#777", marginBottom: "20px" }}>
          {modo === "entrar"
            ? "Entre com sua conta para acessar o sistema."
            : "Crie sua conta para acessar o sistema."}
        </p>

        <div style={estiloAbas}>
          <button
            type="button"
            onClick={() => trocarModo("entrar")}
            style={estiloAba(modo === "entrar")}
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => trocarModo("cadastrar")}
            style={estiloAba(modo === "cadastrar")}
          >
            Criar conta
          </button>
        </div>

        <label style={estiloLabel}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={estiloInput}
            autoComplete="username"
            required
          />
        </label>

        <label style={estiloLabel}>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={estiloInput}
            autoComplete={
              modo === "entrar" ? "current-password" : "new-password"
            }
            minLength={6}
            required
          />
        </label>

        {erro && (
          <p style={{ color: "#dc3545", marginBottom: "10px" }}>{erro}</p>
        )}

        {aviso && (
          <p style={{ color: "#2b8a3e", marginBottom: "10px" }}>{aviso}</p>
        )}

        <button type="submit" disabled={carregando} style={estiloBotao}>
          {carregando
            ? "Enviando..."
            : modo === "entrar"
            ? "Entrar"
            : "Criar conta"}
        </button>
      </form>
    </div>
  );
}

const estiloTela = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f4f4f4",
};

const estiloCard = {
  background: "white",
  padding: "40px",
  borderRadius: "15px",
  boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
  width: "100%",
  maxWidth: "380px",
  display: "flex",
  flexDirection: "column",
};

const estiloAbas = {
  display: "flex",
  gap: "8px",
  marginBottom: "22px",
  background: "#f2f2f2",
  padding: "4px",
  borderRadius: "10px",
};

function estiloAba(ativa) {
  return {
    flex: 1,
    padding: "10px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: ativa ? "bold" : "normal",
    background: ativa ? "#D4A019" : "transparent",
    color: ativa ? "#111" : "#555",
  };
}

const estiloLabel = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  fontWeight: "600",
  color: "#444",
  marginBottom: "18px",
};

const estiloInput = {
  padding: "12px",
  border: "1px solid #ccc",
  borderRadius: "8px",
  fontSize: "15px",
};

const estiloBotao = {
  background: "#D4A019",
  color: "#111",
  border: "none",
  padding: "14px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "15px",
  marginTop: "10px",
};

export default Login;
