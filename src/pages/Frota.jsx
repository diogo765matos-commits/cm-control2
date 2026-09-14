import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCaminhoes,
  criarCaminhao,
  excluirCaminhao,
  FROTAS,
  FROTA_TERCEIRIZADA,
  FROTA_BAGACO,
  taxaDaFrota,
  unidadeDaFrota,
} from "../data/caminhoes";
import { db } from "../lib/supabase";
import {
  TRANSPORTADORA_CM,
  TRANSPORTADORA_TERCEIRIZADA,
} from "../data/config";
import { formatarData } from "../utils/formatadores";
import { gerarEBaixarPlanilha } from "../utils/relatorioExcel";
import PageHeader from "../components/PageHeader";

function Frota() {
  const [caminhoes, setCaminhoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const [frotaRelatorio, setFrotaRelatorio] = useState("");
  const [carregandoPeriodos, setCarregandoPeriodos] = useState(false);
  const [semPeriodos, setSemPeriodos] = useState(false);
  const [inicioRelatorio, setInicioRelatorio] = useState("");
  const [fimRelatorio, setFimRelatorio] = useState("");
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);

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

  async function abrirRelatorio(tipoFrota) {
    setFrotaRelatorio(tipoFrota);
    setMostrarRelatorio(true);
    setSemPeriodos(false);
    setInicioRelatorio("");
    setFimRelatorio("");

    setCarregandoPeriodos(true);

    try {
      const [caminhoesTodos, semanas] = await Promise.all([
        db.select("caminhoes", "select=id,frota"),
        db.select("viagens_semanas", "select=inicio,fim,caminhao_id"),
      ]);

      const idsDaFrota = new Set(
        caminhoesTodos
          .filter((c) => c.frota === tipoFrota)
          .map((c) => c.id)
      );

      const semanasDaFrota = semanas.filter((semana) =>
        idsDaFrota.has(semana.caminhao_id)
      );

      if (semanasDaFrota.length === 0) {
        setSemPeriodos(true);
        return;
      }

      const maisRecente = semanasDaFrota.reduce((atual, semana) =>
        !atual || semana.inicio > atual.inicio ? semana : atual
      , null);

      setInicioRelatorio(maisRecente.inicio);
      setFimRelatorio(maisRecente.fim);
    } catch (e) {
      alert("Não foi possível carregar os períodos: " + e.message);
    } finally {
      setCarregandoPeriodos(false);
    }
  }

  function aplicarAtalhoPeriodo(dias) {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - dias + 1);

    setInicioRelatorio(inicio.toISOString().slice(0, 10));
    setFimRelatorio(fim.toISOString().slice(0, 10));
  }

  async function gerarRelatorio() {
    if (!inicioRelatorio || !fimRelatorio) {
      alert("Escolha o início e o fim do período.");
      return;
    }

    if (inicioRelatorio > fimRelatorio) {
      alert("A data de início precisa ser antes (ou igual) à data de fim.");
      return;
    }

    const ExcelJS = window.ExcelJS;

    if (!ExcelJS) {
      alert(
        "Não foi possível carregar o gerador de planilhas. Recarregue a página e tente de novo."
      );
      return;
    }

    setGerandoRelatorio(true);

    try {
      const transportadora =
        frotaRelatorio === FROTA_TERCEIRIZADA
          ? TRANSPORTADORA_TERCEIRIZADA
          : TRANSPORTADORA_CM;

      const taxa = taxaDaFrota(frotaRelatorio);
      const unidade = unidadeDaFrota(frotaRelatorio);

      const [caminhoesTodos, semanas] = await Promise.all([
        db.select("caminhoes", "select=id,frota,placa"),
        db.select(
          "viagens_semanas",
          `select=viagens,caminhao_id&inicio=gte.${inicioRelatorio}&inicio=lte.${fimRelatorio}`
        ),
      ]);

      const idsDaFrota = new Set(
        caminhoesTodos
          .filter((c) => c.frota === frotaRelatorio)
          .map((c) => c.id)
      );

      const placaPorId = new Map(
        caminhoesTodos.map((c) => [c.id, c.placa])
      );

      const viagensDaFrota = [];

      semanas
        .filter((semana) => idsDaFrota.has(semana.caminhao_id))
        .forEach((semana) => {
          const placa = placaPorId.get(semana.caminhao_id) || "";

          (semana.viagens || []).forEach((viagem) => {
            viagensDaFrota.push({ ...viagem, placa });
          });
        });

      const rotuloFrota =
        frotaRelatorio === FROTA_TERCEIRIZADA
          ? "Terceirizada"
          : frotaRelatorio === FROTA_BAGACO
          ? "BagacoDeCana"
          : "CM";
      const nomeArquivo = `Fechamento_${rotuloFrota}_${inicioRelatorio}_a_${fimRelatorio}.xlsx`;

      const gerou = await gerarEBaixarPlanilha({
        ExcelJS,
        nomeArquivo,
        periodoLabel: `${formatarData(inicioRelatorio)} a ${formatarData(fimRelatorio)}`,
        transportadora,
        unidade,
        taxa,
        viagens: viagensDaFrota,
        comFiscal: frotaRelatorio !== FROTA_BAGACO,
        comAbasPorCaminhao: true,
      });

      if (!gerou) {
        alert("Não há viagens cadastradas para esse período.");
        return;
      }

      setMostrarRelatorio(false);
    } catch (e) {
      alert("Não foi possível gerar a planilha: " + e.message);
    } finally {
      setGerandoRelatorio(false);
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

      {mostrarRelatorio && (
        <div
          style={estiloModalFundo}
          onClick={() => setMostrarRelatorio(false)}
        >
          <div style={estiloModalCaixa} onClick={(e) => e.stopPropagation()}>
            <h3>
              Gerar Relatório —{" "}
              {FROTAS.find((f) => f.tipo === frotaRelatorio)?.titulo}
            </h3>

            <p style={estiloLegenda}>
              Junta as viagens dos caminhões dessa frota no período escolhido
              num arquivo Excel, igual ao que você já manda pra empresa.
            </p>

            {carregandoPeriodos ? (
              <p style={{ marginTop: "16px" }}>Carregando períodos...</p>
            ) : semPeriodos ? (
              <p style={{ ...estiloLegenda, marginTop: "16px" }}>
                Nenhuma semana com viagens cadastradas ainda.
              </p>
            ) : (
              <>
                <div style={estiloAtalhosPeriodo}>
                  <button
                    type="button"
                    style={estiloBotaoAtalho}
                    onClick={() => aplicarAtalhoPeriodo(7)}
                  >
                    Últimos 7 dias
                  </button>

                  <button
                    type="button"
                    style={estiloBotaoAtalho}
                    onClick={() => aplicarAtalhoPeriodo(14)}
                  >
                    Últimos 14 dias
                  </button>

                  <button
                    type="button"
                    style={estiloBotaoAtalho}
                    onClick={() => aplicarAtalhoPeriodo(30)}
                  >
                    Últimos 30 dias
                  </button>
                </div>

                <label style={estiloLabelModal}>
                  Início

                  <input
                    type="date"
                    value={inicioRelatorio}
                    onChange={(e) => setInicioRelatorio(e.target.value)}
                    style={estiloInput}
                  />
                </label>

                <label style={estiloLabelModal}>
                  Fim

                  <input
                    type="date"
                    value={fimRelatorio}
                    onChange={(e) => setFimRelatorio(e.target.value)}
                    style={estiloInput}
                  />
                </label>

                <div style={estiloAcoesFormulario}>
                  <button
                    style={estiloBotaoCancelar}
                    onClick={() => setMostrarRelatorio(false)}
                  >
                    Cancelar
                  </button>

                  <button
                    style={estiloBotaoDourado}
                    disabled={gerandoRelatorio}
                    onClick={gerarRelatorio}
                  >
                    {gerandoRelatorio ? "Gerando..." : "📥 Gerar e Baixar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {FROTAS.map((frota) => (
        <SecaoFrota
          key={frota.tipo}
          titulo={frota.titulo}
          caminhoes={caminhoes.filter((c) => c.frota === frota.tipo)}
          onAdicionar={(dados) => adicionarCaminhao(dados, frota.tipo)}
          onExcluir={excluir}
          onRelatorio={() => abrirRelatorio(frota.tipo)}
        />
      ))}
    </div>
  );
}

function SecaoFrota({ titulo, caminhoes, onAdicionar, onExcluir, onRelatorio }) {
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

        <div style={estiloAcoesTopoSecao}>
          <button style={estiloBotaoRelatorio} onClick={onRelatorio}>
            📊 Relatório Semanal (Excel)
          </button>

          <button
            style={estiloBotaoDourado}
            onClick={() => setMostrarFormulario(true)}
          >
            + Novo Caminhão
          </button>
        </div>
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
                  onClick={() => navigate(`/caminhao/${caminhao.id}`)}
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

const estiloAcoesTopoSecao = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
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

const estiloBotaoRelatorio = {
  background: "var(--cor-sidebar)",
  color: "white",
  border: "none",
  padding: "12px 20px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const estiloModalFundo = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
  padding: "20px",
};

const estiloModalCaixa = {
  background: "white",
  borderRadius: "var(--raio)",
  padding: "28px",
  maxWidth: "420px",
  width: "100%",
  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
};

const estiloLabelModal = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  fontWeight: "600",
  color: "#444",
  marginTop: "18px",
};

const estiloAtalhosPeriodo = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "16px",
};

const estiloBotaoAtalho = {
  background: "#f2f2f2",
  color: "#333",
  border: "1px solid var(--cor-borda)",
  padding: "6px 12px",
  borderRadius: "999px",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "600",
};

export default Frota;
