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
import { converterNumero, formatarData } from "../utils/formatadores";
import { chavePeriodo } from "../utils/resumoPeriodos";
import PageHeader from "../components/PageHeader";

function Frota() {
  const [caminhoes, setCaminhoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [mostrarRelatorio, setMostrarRelatorio] = useState(false);
  const [frotaRelatorio, setFrotaRelatorio] = useState("");
  const [carregandoPeriodos, setCarregandoPeriodos] = useState(false);
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState([]);
  const [periodoEscolhido, setPeriodoEscolhido] = useState("");
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
    setPeriodosDisponiveis([]);
    setPeriodoEscolhido("");

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

      const mapa = new Map();
      semanas
        .filter((semana) => idsDaFrota.has(semana.caminhao_id))
        .forEach((semana) => {
          mapa.set(chavePeriodo(semana.inicio, semana.fim), {
            inicio: semana.inicio,
            fim: semana.fim,
          });
        });

      const lista = Array.from(mapa.values()).sort((a, b) =>
        a.inicio < b.inicio ? 1 : -1
      );

      setPeriodosDisponiveis(lista);

      if (lista.length > 0) {
        setPeriodoEscolhido(chavePeriodo(lista[0].inicio, lista[0].fim));
      }
    } catch (e) {
      alert("Não foi possível carregar os períodos: " + e.message);
    } finally {
      setCarregandoPeriodos(false);
    }
  }

  async function gerarRelatorio() {
    const periodo = periodosDisponiveis.find(
      (p) => chavePeriodo(p.inicio, p.fim) === periodoEscolhido
    );

    if (!periodo) {
      alert("Escolha um período.");
      return;
    }

    const XLSX = window.XLSX;

    if (!XLSX) {
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
        db.select("caminhoes", "select=id,frota"),
        db.select(
          "viagens_semanas",
          `select=viagens,caminhao_id&inicio=eq.${periodo.inicio}&fim=eq.${periodo.fim}`
        ),
      ]);

      const idsDaFrota = new Set(
        caminhoesTodos
          .filter((c) => c.frota === frotaRelatorio)
          .map((c) => c.id)
      );

      const linhas = [];

      semanas
        .filter((semana) => idsDaFrota.has(semana.caminhao_id))
        .forEach((semana) => {
          (semana.viagens || []).forEach((viagem) => {
            const volFiscal = converterNumero(viagem.volFiscal) || 0;
            const volEntregue = converterNumero(viagem.volEntregue) || 0;
            const diferenca = Number((volEntregue - volFiscal).toFixed(2));

            linhas.push({
              data: viagem.data,
              nf: viagem.nf,
              volFiscal,
              volEntregue,
              diferenca,
              cte: viagem.cte,
              valorFiscal: volFiscal * taxa,
              complemento: diferenca * taxa,
              valorFisico: volEntregue * taxa,
              dataEntrega: viagem.dataEntrega,
            });
          });
        });

      if (linhas.length === 0) {
        alert("Não há viagens cadastradas para esse período.");
        return;
      }

      linhas.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

      const totalValorFiscal = linhas.reduce((s, l) => s + l.valorFiscal, 0);
      const totalComplemento = linhas.reduce((s, l) => s + l.complemento, 0);
      const totalValorFisico = linhas.reduce((s, l) => s + l.valorFisico, 0);
      const totalVolFiscal = linhas.reduce((s, l) => s + l.volFiscal, 0);
      const totalVolEntregue = Number(
        linhas.reduce((s, l) => s + l.volEntregue, 0).toFixed(2)
      );
      const totalDiferenca = Number(
        linhas.reduce((s, l) => s + l.diferenca, 0).toFixed(2)
      );

      const aoa = [
        ["FECHAMENTO FINANCEIRO DE TRANSPORTE"],
        [
          "Período:",
          `${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)}`,
          null,
          null,
          null,
          null,
          null,
          "Transportadora:",
          transportadora,
        ],
        [
          "VALOR FISCAL TOTAL",
          null,
          null,
          null,
          "COMPLEMENTO TOTAL",
          null,
          null,
          null,
          "VALOR FISICO TOTAL",
        ],
        [
          totalValorFiscal,
          null,
          null,
          null,
          totalComplemento,
          null,
          null,
          null,
          totalValorFisico,
        ],
        [],
        [],
        [
          "Data NF",
          "Nº NF",
          `${unidade.abreviado} Fiscal    (${unidade.curta})`,
          `${unidade.abreviado} Entregue  (${unidade.curta})`,
          `Diferença     (${unidade.curta})`,
          "CT-e",
          "Transportadora",
          `Frete R$/${unidade.curta}`,
          "Valor Fiscal",
          "Complemento",
          "Valor Fisico",
          "Data Transporte",
        ],
        ...linhas.map((l) => [
          formatarData(l.data),
          l.nf || "",
          l.volFiscal,
          l.volEntregue,
          l.diferenca,
          l.cte || "",
          transportadora,
          taxa,
          l.valorFiscal,
          l.complemento,
          l.valorFisico,
          l.dataEntrega ? formatarData(l.dataEntrega) : "",
        ]),
        [
          "TOTAL GERAL= ",
          linhas.length,
          totalVolFiscal,
          totalVolEntregue,
          totalDiferenca,
          null,
          null,
          null,
          totalValorFiscal,
          totalComplemento,
          totalValorFisico,
          null,
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
        { s: { r: 2, c: 4 }, e: { r: 2, c: 7 } },
        { s: { r: 2, c: 8 }, e: { r: 2, c: 11 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
        { s: { r: 3, c: 4 }, e: { r: 3, c: 7 } },
        { s: { r: 3, c: 8 }, e: { r: 3, c: 11 } },
      ];

      ws["!cols"] = [
        { wch: 12 },
        { wch: 8 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
        { wch: 10 },
        { wch: 22 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");

      const wsDashboard = XLSX.utils.aoa_to_sheet([
        ["DASHBOARD"],
        [],
        ["Indicador", "Valor"],
        ["Valor Fiscal", totalValorFiscal],
        ["Complemento", totalComplemento],
        ["Valor Físico", totalValorFisico],
        ["Qtd. CT-es", linhas.filter((l) => l.cte).length],
      ]);
      XLSX.utils.book_append_sheet(wb, wsDashboard, "Dashboard");

      const rotuloFrota =
        frotaRelatorio === FROTA_TERCEIRIZADA
          ? "Terceirizada"
          : frotaRelatorio === FROTA_BAGACO
          ? "BagacoDeCana"
          : "CM";
      const nomeArquivo = `Fechamento_${rotuloFrota}_${periodo.inicio}_a_${periodo.fim}.xlsx`;
      XLSX.writeFile(wb, nomeArquivo);

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
            ) : periodosDisponiveis.length === 0 ? (
              <p style={{ ...estiloLegenda, marginTop: "16px" }}>
                Nenhuma semana com viagens cadastradas ainda.
              </p>
            ) : (
              <>
                <label style={estiloLabelModal}>
                  Período

                  <select
                    value={periodoEscolhido}
                    onChange={(e) => setPeriodoEscolhido(e.target.value)}
                    style={estiloInput}
                  >
                    {periodosDisponiveis.map((p) => {
                      const chave = chavePeriodo(p.inicio, p.fim);

                      return (
                        <option key={chave} value={chave}>
                          {formatarData(p.inicio)} até {formatarData(p.fim)}
                        </option>
                      );
                    })}
                  </select>
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

export default Frota;
