import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCaminhoes,
  criarCaminhao,
  excluirCaminhao,
  FROTAS,
} from "../data/caminhoes";
import PageHeader from "../components/PageHeader";

function Frota() {
  const [caminhoes, setCaminhoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setCarregando(true);

    try {
      const dados = await getCaminhoes();
      setCaminhoes(dados);
      setErro("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function adicionarCaminhao(dados, tipoFrota) {
    const placa = dados.placa.toUpperCase();

    const jaExiste = caminhoes.some((c) => c.placa === placa);

    if (jaExiste) {
      alert("Já existe um caminhão cadastrado com essa placa.");
      return false;
    }

    try {
      const novo = await criarCaminhao(dados, tipoFrota);
      setCaminhoes((atuais) => [...atuais, novo]);
      return true;
    } catch (e) {
      alert("Não foi possível salvar o caminhão: " + e.message);
      return false;
    }
  }

  async function excluir(id) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir este caminhão?"
    );

    if (!confirmar) return;

    try {
      await excluirCaminhao(id);
      setCaminhoes((atuais) =>
        atuais.filter((caminhao) => caminhao.id !== id)
      );
    } catch (e) {
      alert("Não foi possível excluir o caminhão: " + e.message);
    }
  }

  if (carregando) {
    return <p>Carregando frota...</p>;
  }

  if (erro) {
    return (
      <p style={{ color: "#dc3545" }}>Erro ao carregar a frota: {erro}</p>
    );
  }

  return (
    <div>
      <PageHeader
        titulo="Frota"
        subtitulo={`${caminhoes.length} caminhão(ões) cadastrado(s) ao todo.`}
      />

      {FROTAS.map((frota) => (
        <SecaoFrota
          key={frota.tipo}
          titulo={frota.titulo}
          caminhoes={caminhoes.filter((c) => c.frota === frota.tipo)}
          onAdicionar={(dados) => adicionarCaminhao(dados, frota.tipo)}
          onExcluir={excluir}
        />
      ))}
    </div>
  );
}

function SecaoFrota({ titulo, caminhoes, onAdicionar, onExcluir }) {
  const navigate = useNavigate();

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [novoCaminhao, setNovoCaminhao] = useState({
    modelo: "",
    placa: "",
    motorista: "",
  });

  async function salvar() {
    if (
      !novoCaminhao.modelo.trim() ||
      !novoCaminhao.placa.trim() ||
      !novoCaminhao.motorista.trim()
    ) {
      alert("Preencha todos os campos.");
      return;
    }

    setSalvando(true);

    const sucesso = await onAdicionar(novoCaminhao);

    setSalvando(false);

    if (sucesso === false) {
      return;
    }

    setNovoCaminhao({ modelo: "", placa: "", motorista: "" });
    setMostrarFormulario(false);
  }

  return (
    <section style={estiloSecao}>
      <div style={estiloTopoSecao}>
        <div>
          <h2 style={estiloTituloSecao}>{titulo}</h2>
          <p style={estiloLegenda}>
            {caminhoes.length}{" "}
            {caminhoes.length === 1 ? "caminhão" : "caminhões"}
          </p>
        </div>

        <button
          style={estiloBotaoDourado}
          onClick={() => setMostrarFormulario(true)}
        >
          + Novo Caminhão
        </button>
      </div>

      {mostrarFormulario && (
        <div style={estiloFormulario}>
          <h3 style={{ marginBottom: "6px" }}>Novo Caminhão — {titulo}</h3>

          <div style={estiloCampos}>
            <input
              type="text"
              placeholder="Modelo do caminhão"
              value={novoCaminhao.modelo}
              style={estiloInput}
              onChange={(e) =>
                setNovoCaminhao({ ...novoCaminhao, modelo: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Placa"
              value={novoCaminhao.placa}
              style={estiloInput}
              onChange={(e) =>
                setNovoCaminhao({ ...novoCaminhao, placa: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Motorista"
              value={novoCaminhao.motorista}
              style={estiloInput}
              onChange={(e) =>
                setNovoCaminhao({
                  ...novoCaminhao,
                  motorista: e.target.value,
                })
              }
            />
          </div>

          <div style={estiloAcoesFormulario}>
            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              style={estiloBotaoCancelar}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              style={estiloBotaoDourado}
            >
              {salvando ? "Salvando..." : "Salvar Caminhão"}
            </button>
          </div>
        </div>
      )}

      {caminhoes.length === 0 ? (
        <div style={estiloVazio}>
          <h3>Nenhum caminhão cadastrado nesta frota ainda.</h3>
        </div>
      ) : (
        <div style={estiloGrid}>
          {caminhoes.map((caminhao) => (
            <div style={estiloCardCaminhao} key={caminhao.id}>
              <div style={estiloTopoCard}>
                <h3 style={estiloModelo}>🚛 {caminhao.modelo}</h3>
                <span style={estiloBadge}>Ativo</span>
              </div>

              <div style={estiloInfoLinha}>
                <span style={estiloInfoLabel}>Placa</span>
                <strong>{caminhao.placa}</strong>
              </div>

              <div style={estiloInfoLinha}>
                <span style={estiloInfoLabel}>Motorista</span>
                <strong>{caminhao.motorista}</strong>
              </div>

              <div style={estiloAcoesCard}>
                <button
                  style={estiloBotaoEscuro}
                  onClick={() => navigate(`/caminhao/${caminhao.placa}`)}
                >
                  Abrir →
                </button>

                <button
                  onClick={() => onExcluir(caminhao.id)}
                  style={estiloBotaoExcluir}
                >
                  🗑 Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const estiloSecao = {
  background: "var(--cor-card)",
  borderRadius: "var(--raio)",
  boxShadow: "var(--sombra-card)",
  padding: "26px",
  marginBottom: "24px",
};

const estiloTopoSecao = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginBottom: "22px",
  flexWrap: "wrap",
};

const estiloTituloSecao = {
  fontSize: "18px",
};

const estiloLegenda = {
  color: "var(--cor-texto-secundario)",
  fontSize: "13px",
  marginTop: "4px",
};

const estiloBotaoDourado = {
  background: "var(--cor-primaria)",
  color: "white",
  border: "none",
  padding: "12px 20px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
  fontWeight: "bold",
};

const estiloBotaoCancelar = {
  background: "#eee",
  color: "#333",
  border: "none",
  padding: "12px 20px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
};

const estiloFormulario = {
  background: "#f9fafb",
  border: "1px solid var(--cor-borda)",
  padding: "20px",
  borderRadius: "var(--raio-pequeno)",
  marginBottom: "22px",
};

const estiloCampos = {
  display: "flex",
  gap: "14px",
  marginTop: "16px",
  flexWrap: "wrap",
};

const estiloInput = {
  flex: 1,
  minWidth: "180px",
  padding: "12px",
  border: "1px solid var(--cor-borda)",
  borderRadius: "var(--raio-pequeno)",
  fontSize: "14px",
  background: "white",
};

const estiloAcoesFormulario = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "18px",
};

const estiloVazio = {
  textAlign: "center",
  padding: "40px 20px",
  background: "#fafafa",
  border: "1px dashed #ccc",
  borderRadius: "12px",
  color: "#777",
};

const estiloGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "16px",
};

const estiloCardCaminhao = {
  border: "1px solid var(--cor-borda)",
  borderRadius: "var(--raio-pequeno)",
  padding: "18px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const estiloTopoCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
};

const estiloModelo = {
  fontSize: "16px",
};

const estiloBadge = {
  background: "var(--cor-primaria-clara)",
  color: "var(--cor-primaria-escura)",
  fontSize: "11px",
  fontWeight: "bold",
  padding: "4px 10px",
  borderRadius: "999px",
  whiteSpace: "nowrap",
};

const estiloInfoLinha = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "14px",
  color: "var(--cor-texto)",
};

const estiloInfoLabel = {
  color: "var(--cor-texto-secundario)",
};

const estiloAcoesCard = {
  display: "flex",
  gap: "8px",
  marginTop: "8px",
};

const estiloBotaoEscuro = {
  flex: 1,
  background: "var(--cor-sidebar)",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
  fontSize: "13px",
};

const estiloBotaoExcluir = {
  background: "var(--cor-perigo-clara)",
  color: "var(--cor-perigo)",
  border: "none",
  padding: "10px 14px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

export default Frota;
