import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/supabase";
import { formatarData, formatarMoeda, formatarNumero } from "../utils/formatadores";
import {
  calcularResumoPorPeriodo,
  chavePeriodo,
  somarPeriodos,
} from "../utils/resumoPeriodos";
import PageHeader from "../components/PageHeader";
import DateRangeFilter from "../components/DateRangeFilter";
import KpiCard, { CORES_KPI } from "../components/KpiCard";

function Dashboard() {
  const navigate = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [totalCaminhoes, setTotalCaminhoes] = useState(0);
  const [semanasViagens, setSemanasViagens] = useState([]);
  const [semanasAbastecimento, setSemanasAbastecimento] = useState([]);
  const [semanasDespesas, setSemanasDespesas] = useState([]);

  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);

      try {
        const [caminhoes, viagens, abastecimentos, despesas] =
          await Promise.all([
            db.select("caminhoes", "select=id"),
            db.select("viagens_semanas", "select=inicio,fim,viagens"),
            db.select(
              "abastecimento_semanas",
              "select=inicio,fim,abastecimentos"
            ),
            db.select("despesas_semanas", "select=inicio,fim,despesas"),
          ]);

        if (!ativo) return;

        setTotalCaminhoes(caminhoes.length);
        setSemanasViagens(viagens);
        setSemanasAbastecimento(abastecimentos);
        setSemanasDespesas(despesas);
        setErro("");
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregar();

    return () => {
      ativo = false;
    };
  }, []);

  if (carregando) {
    return <p>Carregando...</p>;
  }

  if (erro) {
    return (
      <p style={{ color: "#dc3545" }}>Erro ao carregar o painel: {erro}</p>
    );
  }

  const periodos = calcularResumoPorPeriodo(
    semanasViagens,
    semanasAbastecimento,
    semanasDespesas,
    { inicioFiltro: filtroInicio, fimFiltro: filtroFim }
  );

  const totalGeral = somarPeriodos(periodos);

  return (
    <div>
      <PageHeader
        titulo="Painel"
        subtitulo="Visão geral do desempenho da frota"
      >
        <DateRangeFilter
          inicio={filtroInicio}
          fim={filtroFim}
          onAplicar={(inicio, fim) => {
            setFiltroInicio(inicio);
            setFiltroFim(fim);
          }}
          onLimpar={() => {
            setFiltroInicio("");
            setFiltroFim("");
          }}
        />
      </PageHeader>

      <div style={estiloGridKpis}>
        <KpiCard
          icone="🚚"
          cor={CORES_KPI.verde}
          rotulo="Viagens"
          valor={totalGeral.totalViagens}
          legenda="Total no período"
        />
        <KpiCard
          icone="💰"
          cor={CORES_KPI.verde}
          rotulo="Receita Bruta"
          valor={formatarMoeda(totalGeral.receitaBruta)}
          legenda="Total no período"
        />
        <KpiCard
          icone="⛽"
          cor={CORES_KPI.roxo}
          rotulo="Combustível"
          valor={formatarMoeda(totalGeral.totalCombustivel)}
          legenda="Total no período"
        />
        <KpiCard
          icone="🧾"
          cor={CORES_KPI.laranja}
          rotulo="Despesas Extras"
          valor={formatarMoeda(totalGeral.totalDespesasExtras)}
          legenda="Total no período"
        />
        <KpiCard
          icone="📈"
          cor={CORES_KPI.verde}
          rotulo="Lucro da Frota"
          valor={formatarMoeda(totalGeral.lucro)}
          legenda="Total no período"
        />
      </div>

      <div style={estiloCard}>
        <h3 style={estiloTituloCard}>Resumo por Período (Semanal)</h3>

        <p style={estiloLegendaPeriodo}>
          {totalCaminhoes} caminhão(ões) cadastrado(s). Os períodos só se
          somam entre caminhões quando o início e o fim batem exatamente.
          Clique num período para ver as viagens e os gráficos daquela
          semana.
        </p>

        {periodos.length === 0 ? (
          <div style={estiloVazio}>
            <h3>Nenhuma semana no período selecionado</h3>
            <p>Ajuste o filtro ou cadastre viagens em algum caminhão.</p>
          </div>
        ) : (
          <div style={estiloTabelaContainer}>
            <table style={estiloTabela}>
              <thead>
                <tr>
                  <th style={estiloTh}>Período</th>
                  <th style={estiloTh}>Viagens</th>
                  <th style={estiloTh}>Volume Entregue</th>
                  <th style={estiloTh}>Receita Bruta</th>
                  <th style={estiloTh}>Combustível</th>
                  <th style={estiloTh}>Despesas Extras</th>
                  <th style={estiloTh}>Motoristas (10%)</th>
                  <th style={estiloTh}>Lucro da Frota</th>
                </tr>
              </thead>

              <tbody>
                {periodos.map((periodo) => (
                  <tr
                    key={chavePeriodo(periodo.inicio, periodo.fim)}
                    onClick={() =>
                      navigate(`/periodo/${periodo.inicio}/${periodo.fim}`)
                    }
                    style={estiloLinhaClicavel}
                  >
                    <td style={estiloTd}>
                      {formatarData(periodo.inicio)} até{" "}
                      {formatarData(periodo.fim)}{" "}
                      <span style={estiloSetaPeriodo}>→</span>
                    </td>
                    <td style={estiloTd}>{periodo.totalViagens}</td>
                    <td style={estiloTd}>
                      {formatarNumero(periodo.volumeEntregue)}
                    </td>
                    <td style={estiloTd}>
                      {formatarMoeda(periodo.receitaBruta)}
                    </td>
                    <td style={estiloTd}>
                      {formatarMoeda(periodo.totalCombustivel)}
                    </td>
                    <td style={estiloTd}>
                      {formatarMoeda(periodo.totalDespesasExtras)}
                    </td>
                    <td style={estiloTd}>
                      {formatarMoeda(periodo.pagamentoMotoristas)}
                    </td>
                    <td
                      style={{
                        ...estiloTd,
                        fontWeight: "bold",
                        color: periodo.lucro < 0 ? "#dc2626" : "#111827",
                      }}
                    >
                      {formatarMoeda(periodo.lucro)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td style={estiloTdTotal}>Total Geral</td>
                  <td style={estiloTdTotal}>{totalGeral.totalViagens}</td>
                  <td style={estiloTdTotal}>
                    {formatarNumero(totalGeral.volumeEntregue)}
                  </td>
                  <td style={estiloTdTotal}>
                    {formatarMoeda(totalGeral.receitaBruta)}
                  </td>
                  <td style={estiloTdTotal}>
                    {formatarMoeda(totalGeral.totalCombustivel)}
                  </td>
                  <td style={estiloTdTotal}>
                    {formatarMoeda(totalGeral.totalDespesasExtras)}
                  </td>
                  <td style={estiloTdTotal}>
                    {formatarMoeda(totalGeral.pagamentoMotoristas)}
                  </td>
                  <td
                    style={{
                      ...estiloTdTotal,
                      color: totalGeral.lucro < 0 ? "#dc2626" : "#16a34a",
                    }}
                  >
                    {formatarMoeda(totalGeral.lucro)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const estiloGridKpis = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const estiloCard = {
  background: "var(--cor-card)",
  borderRadius: "var(--raio)",
  boxShadow: "var(--sombra-card)",
  padding: "24px",
  marginBottom: "24px",
};

const estiloTituloCard = {
  marginBottom: "18px",
};

const estiloLegendaPeriodo = {
  color: "var(--cor-texto-secundario)",
  fontSize: "13px",
  marginBottom: "20px",
};

const estiloVazio = {
  textAlign: "center",
  padding: "50px 20px",
  background: "#fafafa",
  border: "1px dashed #ccc",
  borderRadius: "12px",
  color: "#777",
};

const estiloTabelaContainer = {
  overflowX: "auto",
  border: "1px solid var(--cor-borda)",
  borderRadius: "10px",
};

const estiloTabela = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "950px",
};

const estiloTh = {
  background: "#f9fafb",
  color: "var(--cor-texto-secundario)",
  padding: "12px 14px",
  textAlign: "left",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--cor-borda)",
};

const estiloTd = {
  padding: "14px",
  borderBottom: "1px solid var(--cor-borda)",
  whiteSpace: "nowrap",
  fontSize: "14px",
};

const estiloTdTotal = {
  padding: "14px",
  whiteSpace: "nowrap",
  fontWeight: "bold",
  background: "#f9fafb",
  borderTop: "2px solid var(--cor-borda)",
};

const estiloLinhaClicavel = {
  cursor: "pointer",
};

const estiloSetaPeriodo = {
  color: "var(--cor-primaria)",
  fontWeight: "bold",
};

export default Dashboard;
