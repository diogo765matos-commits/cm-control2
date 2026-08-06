import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCaminhoes,
  criarCaminhao,
  excluirCaminhao,
  FROTAS,
} from "../data/caminhoes";
import "../styles/frota.css";

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
      setCaminhoes((atuais) => atuais.filter((caminhao) => caminhao.id !== id));
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
    <>
      {FROTAS.map((frota) => (
        <SecaoFrota
          key={frota.tipo}
          titulo={frota.titulo}
          caminhoes={caminhoes.filter((c) => c.frota === frota.tipo)}
          onAdicionar={(dados) => adicionarCaminhao(dados, frota.tipo)}
          onExcluir={excluir}
        />
      ))}
    </>
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
    <section className="secao-frota">
      <div className="topo">
        <h1>{titulo}</h1>

        <button className="novo" onClick={() => setMostrarFormulario(true)}>
          + Novo Caminhão
        </button>
      </div>

      {mostrarFormulario && (
        <div className="form-novo-caminhao">
          <h2>Novo Caminhão — {titulo}</h2>

          <input
            type="text"
            placeholder="Modelo do caminhão"
            value={novoCaminhao.modelo}
            onChange={(e) =>
              setNovoCaminhao({ ...novoCaminhao, modelo: e.target.value })
            }
          />

          <input
            type="text"
            placeholder="Placa"
            value={novoCaminhao.placa}
            onChange={(e) =>
              setNovoCaminhao({ ...novoCaminhao, placa: e.target.value })
            }
          />

          <input
            type="text"
            placeholder="Motorista"
            value={novoCaminhao.motorista}
            onChange={(e) =>
              setNovoCaminhao({ ...novoCaminhao, motorista: e.target.value })
            }
          />

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar Caminhão"}
            </button>

            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              style={{
                background: "#eee",
                color: "#333",
                border: "none",
                padding: "12px 20px",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {caminhoes.length === 0 ? (
        <p className="secao-frota-vazia">
          Nenhum caminhão cadastrado nesta frota ainda.
        </p>
      ) : (
        <div className="grid">
          {caminhoes.map((caminhao) => (
            <div className="cardCaminhao" key={caminhao.id}>
              <h2>🚛 {caminhao.modelo}</h2>

              <p>
                <strong>Placa: </strong>
                {caminhao.placa}
              </p>

              <p>
                <strong>Motorista: </strong>
                {caminhao.motorista}
              </p>

              <button onClick={() => navigate(`/caminhao/${caminhao.placa}`)}>
                Abrir →
              </button>

              <button
                onClick={() => onExcluir(caminhao.id)}
                style={{
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  marginLeft: "10px",
                }}
              >
                🗑 Excluir Caminhão
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Frota;
