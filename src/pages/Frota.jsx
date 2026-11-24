import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getCaminhoes,
  criarCaminhao,
  excluirCaminhao,
  FROTAS,
} from "../data/caminhoes";
import { MotoristasFrotaV2 } from "../v2/FrotaV2";
import PageHeader from "../components/PageHeader";
import "../styles/frota.css";

function Frota() {
  const [caminhoes, setCaminhoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [frotaAtiva, setFrotaAtiva] = useState("cm");
  const [visualizacao, setVisualizacao] = useState("motoristas");
  const [gerenciamento, setGerenciamento] = useState(false);

  useEffect(() => {
    let ativo = true;

    getCaminhoes()
      .then((dados) => {
        if (!ativo) return;
        setCaminhoes(dados);
        setErro("");
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
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
    <div className="frota-page">
      <PageHeader
        titulo="Frota"
        subtitulo={`${caminhoes.length} caminhão(ões) cadastrado(s) ao todo.`}
      />

      <div className="v2-actions" aria-label="Frota">
        {FROTAS.filter(f => f.tipo !== "bagaco").map(f =>
          <button key={f.tipo} aria-pressed={frotaAtiva === f.tipo} onClick={() => setFrotaAtiva(f.tipo)}>{f.titulo}</button>)}
      </div>
      <div className="v2-actions" aria-label="Visualização da frota">
        <button aria-pressed={visualizacao === "motoristas"} onClick={() => setVisualizacao("motoristas")}>Motoristas</button>
        <button aria-pressed={visualizacao === "caminhoes"} onClick={() => setVisualizacao("caminhoes")}>Caminhões</button>
        <button aria-pressed={gerenciamento} onClick={() => setGerenciamento(v => !v)}>Gerenciar cadastros</button>
        <Link to="/frota/taxas">Taxas e comissões</Link>
      </div>
      {visualizacao === "motoristas" && <MotoristasFrotaV2 key={frotaAtiva} frota={frotaAtiva} gerenciamento={gerenciamento} />}
      {visualizacao === "caminhoes" && FROTAS.filter(f => f.tipo === frotaAtiva).map(f => (
        <SecaoFrota key={f.tipo} titulo={f.titulo} caminhoes={caminhoes.filter(c => c.frota === f.tipo)}
          onAdicionar={dados => adicionarCaminhao(dados, f.tipo)} permitirSemMotorista={f.tipo === "cm"} />
      ))}
      <SecaoFrota titulo="Frota de Bagaço de Cana" caminhoes={caminhoes.filter(c => c.frota === "bagaco")}
        onAdicionar={dados => adicionarCaminhao(dados, "bagaco")} onExcluir={excluir} />
    </div>
  );
}

function SecaoFrota({ titulo, caminhoes, onAdicionar, onExcluir, permitirSemMotorista = false }) {
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
      (!permitirSemMotorista && !novoCaminhao.motorista.trim())
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
    <section className="frota-secao">
      <div className="frota-secao-cabecalho">
        <div>
          <h2 className="frota-secao-titulo">{titulo}</h2>
          <p className="frota-legenda">
            {caminhoes.length}{" "}
            {caminhoes.length === 1 ? "caminhão" : "caminhões"}
          </p>
        </div>

        <div className="frota-acoes">
          <button
            className="frota-botao-primario"
            onClick={() => setMostrarFormulario(true)}
          >
            + Novo Caminhão
          </button>
        </div>
      </div>

      {mostrarFormulario && (
        <div className="frota-formulario">
          <h3 style={{ marginBottom: "6px" }}>Novo Caminhão — {titulo}</h3>

          <div className="frota-campos">
            <input
              type="text"
              placeholder="Modelo do caminhão"
              aria-label="Modelo do caminhão"
              value={novoCaminhao.modelo}
              className="frota-input"
              onChange={(e) =>
                setNovoCaminhao({ ...novoCaminhao, modelo: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Placa"
              aria-label="Placa"
              value={novoCaminhao.placa}
              className="frota-input"
              onChange={(e) =>
                setNovoCaminhao({ ...novoCaminhao, placa: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Motorista"
              aria-label="Motorista"
              value={novoCaminhao.motorista}
              className="frota-input"
              onChange={(e) =>
                setNovoCaminhao({
                  ...novoCaminhao,
                  motorista: e.target.value,
                })
              }
            />
          </div>

          <div className="frota-formulario-acoes">
            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              className="frota-botao-secundario"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="frota-botao-primario"
            >
              {salvando ? "Salvando..." : "Salvar Caminhão"}
            </button>
          </div>
        </div>
      )}

      {caminhoes.length === 0 ? (
        <div className="frota-vazio">
          <h3>Nenhum caminhão cadastrado nesta frota ainda.</h3>
        </div>
      ) : (
        <div className="frota-grid">
          {caminhoes.map((caminhao) => (
            <div className="frota-card" key={caminhao.id}>
              <div className="frota-card-cabecalho">
                <div>
                  <span className="frota-info-rotulo">Placa</span>
                  <h3 className="frota-placa">{caminhao.placa}</h3>
                </div>
                <span className="frota-status">Ativo</span>
              </div>

              <div className="frota-info">
                <span className="frota-info-rotulo">Modelo</span>
                <strong>{caminhao.modelo}</strong>
              </div>

              <div className="frota-info">
                <span className="frota-info-rotulo">Motorista</span>
                <strong>{caminhao.motorista}</strong>
              </div>

              <div className="frota-card-acoes">
                <button
                  className="frota-botao-abrir"
                  aria-label={`Abrir caminhão ${caminhao.placa}`}
                  onClick={() => navigate(`/caminhao/${caminhao.id}`)}
                >
                  Abrir →
                </button>

                {onExcluir && <button
                  onClick={() => onExcluir(caminhao.id)}
                  className="frota-botao-excluir"
                  aria-label={`Excluir caminhão ${caminhao.placa}`}
                >
                  🗑 Excluir
                </button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Frota;
