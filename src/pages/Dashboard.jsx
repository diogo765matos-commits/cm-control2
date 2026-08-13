import { Fragment, useEffect, useState } from "react";
import { db } from "../lib/supabase";
import {
  formatarData,
  formatarMoeda,
  formatarMoedaCompacta,
  formatarNumero,
  converterNumero,
} from "../utils/formatadores";
import {
  calcularResumoPorPeriodo,
  chavePeriodo,
  somarPeriodos,
} from "../utils/resumoPeriodos";
import { VALOR_POR_VOLUME } from "../data/config";
import PageHeader from "../components/PageHeader";
import DateRangeFilter from "../components/DateRangeFilter";
import KpiCard, { CORES_KPI } from "../components/KpiCard";
import BarChart from "../components/BarChart";
import DonutChart from "../components/DonutChart";

function Dashboard() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [totalCaminhoes, setTotalCaminhoes] = useState(0);
  const [caminhoesPorId, setCaminhoesPorId] = useState({});
  const [semanasViagens, setSemanasViagens] = useState([]);
  const [semanasAbastecimento, setSemanasAbastecimento] = useState([]);
  const [semanasDespesas, setSemanasDespesas] = useState([]);

  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");

  const [periodoExpandido, setPeriodoExpandido] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);

      try {
        const [caminhoes, viagens, abastecimentos, despesas] =
          await Promise.all([
            db.select("caminhoes", "select=id,placa,modelo"),
            db.select(
              "viagens_semanas",
              "select=inicio,fim,viagens,caminhao_id"
            ),
            db.select(
              "abastecimento_semanas",
              "select=inicio,fim,abastecimentos"
            ),
            db.select("despesas_semanas", "select=inicio,fim,despesas"),
          ]);

        if (!ativo) return;

        setTotalCaminhoes(caminhoes.length);

        const mapaCaminhoes = {};
        caminhoes.forEach((c) => {
          mapaCaminhoes[c.id] = c;
        });
        setCaminhoesPorId(mapaCaminhoes);

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

  function obterDetalheViagens(periodo) {
    const linhas = [];

    semanasViagens
      .filter(
        (semana) =>
          semana.inicio === periodo.inicio && semana.fim === periodo.fim
      )
      .forEach((semana) => {
        const caminhao = caminhoesPorId[semana.caminhao_id];

        (semana.viagens || []).forEach((viagem) => {
          const volFiscal = converterNumero(viagem.volFiscal) || 0;
          const volEntregue = converterNumero(viagem.volEntregue) || 0;
          const diferenca = volEntregue - volFiscal;
          const valorFiscal = volFiscal * VALOR_POR_VOLUME;
          const complemento = diferenca * VALOR_POR_VOLUME;
          const valorFisico = volEntregue * VALOR_POR_VOLUME;

          linhas.push({
            id: viagem.id,
            caminhao: caminhao ? `${caminhao.modelo} (${caminhao.placa})` : "-",
            data: viagem.data,
            nf: viagem.nf,
            cte: viagem.cte,
            volFiscal,
            volEntregue,
            diferenca,
            valorFiscal,
            complemento,
            valorFisico,
            dataEntrega: viagem.dataEntrega,
          });
        });
      });

    return linhas.sort((a, b) => (a.data < b.data ? -1 : 1));
  }

  function alternarPeriodo(chave) {
    setPeriodoExpandido((atual) => (atual === chave ? null : chave));
  }

  const dadosGrafico = [...periodos]
    .sort((a, b) => (a.inicio > b.inicio ? 1 : -1))
    .map((periodo) => ({
      label: `${formatarData(periodo.inicio).slice(0, 5)} - ${formatarData(
        periodo.fim
      ).slice(0, 5)}`,
      value: periodo.receitaBruta,
    }));

  const custoTotal = totalGeral.totalCombustivel + totalGeral.totalDespesasExtras;

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
          icone="📦"
          cor={CORES_KPI.azul}
          rotulo="Volume Entregue"
          valor={`${formatarNumero(totalGeral.volumeEntregue)} m³`}
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

      <div style={estiloGridGraficos}>
        <div style={estiloCard}>
          <h3 style={estiloTituloCard}>Receita Bruta por Semana</h3>
          <BarChart dados={dadosGrafico} formatarValor={formatarMoedaCompacta} />
        </div>

        <div style={estiloCard}>
          <h3 style={estiloTituloCard}>Distribuição de Custos (Período)</h3>
          <DonutChart
            valorTotal={custoTotal}
            formatarValor={formatarMoeda}
            segmentos={[
              {
                nome: "Combustível",
                valor: totalGeral.totalCombustivel,
                cor: "#2563eb",
              },
              {
                nome: "Despesas Extras",
                valor: totalGeral.totalDespesasExtras,
                cor: "#16a34a",
              },
            ]}
          />
        </div>
      </div>

      <div style={estiloCard}>
        <h3 style={estiloTituloCard}>Resumo por Período (Semanal)</h3>

        <p style={estiloLegendaPeriodo}>
          {totalCaminhoes} caminhão(ões) cadastrado(s). Os períodos só se
          somam entre caminhões quando o início e o fim batem exatamente.
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
                {periodos.map((periodo) => {
                  const chave = chavePeriodo(periodo.inicio, periodo.fim);
                  const aberto = periodoExpandido === chave;

                  return (
                    <Fragment key={chave}>
                      <tr
                        onClick={() => alternarPeriodo(chave)}
                        style={estiloLinhaClicavel}
                      >
                        <td style={estiloTd}>
                          <span style={estiloSetaPeriodo}>
                            {aberto ? "▾" : "▸"}
                          </span>
                          {formatarData(periodo.inicio)} até{" "}
                          {formatarData(periodo.fim)}
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

                      {aberto && (
                        <tr>
                          <td style={estiloTdDetalhe} colSpan={8}>
                            <DetalhePeriodo
                              viagens={obterDetalheViagens(periodo)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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

function DetalhePeriodo({ viagens }) {
  const totalValorFiscal = viagens.reduce((s, v) => s + v.valorFiscal, 0);
  const totalComplemento = viagens.reduce((s, v) => s + v.complemento, 0);
  const totalValorFisico = viagens.reduce((s, v) => s + v.valorFisico, 0);

  if (viagens.length === 0) {
    return (
      <div style={estiloDetalheVazio}>
        Nenhuma viagem lançada neste período ainda.
      </div>
    );
  }

  return (
    <div>
      <div style={estiloResumoDetalhe}>
        <div style={{ ...estiloCardResumoDetalhe, borderColor: "#16a34a" }}>
          <span style={estiloLabelResumoDetalhe}>Valor Fiscal Total</span>
          <strong style={{ color: "#16a34a" }}>
            {formatarMoeda(totalValorFiscal)}
          </strong>
        </div>

        <div style={{ ...estiloCardResumoDetalhe, borderColor: "#2563eb" }}>
          <span style={estiloLabelResumoDetalhe}>Complemento Total</span>
          <strong style={{ color: "#2563eb" }}>
            {formatarMoeda(totalComplemento)}
          </strong>
        </div>

        <div style={{ ...estiloCardResumoDetalhe, borderColor: "#d97706" }}>
          <span style={estiloLabelResumoDetalhe}>Valor Físico Total</span>
          <strong style={{ color: "#d97706" }}>
            {formatarMoeda(totalValorFisico)}
          </strong>
        </div>
      </div>

      <div style={estiloTabelaDetalheContainer}>
        <table style={estiloTabelaDetalhe}>
          <thead>
            <tr>
              <th style={estiloThDetalhe}>Caminhão</th>
              <th style={estiloThDetalhe}>Data NF</th>
              <th style={estiloThDetalhe}>Nº NF</th>
              <th style={estiloThDetalhe}>Vol. Fiscal</th>
              <th style={estiloThDetalhe}>Vol. Entregue</th>
              <th style={estiloThDetalhe}>Diferença</th>
              <th style={estiloThDetalhe}>CT-e</th>
              <th style={estiloThDetalhe}>Transportadora</th>
              <th style={estiloThDetalhe}>Frete R$/m³</th>
              <th style={estiloThDetalhe}>Valor Fiscal</th>
              <th style={estiloThDetalhe}>Complemento</th>
              <th style={estiloThDetalhe}>Valor Físico</th>
              <th style={estiloThDetalhe}>Data Transporte</th>
            </tr>
          </thead>

          <tbody>
            {viagens.map((viagem) => (
              <tr key={viagem.id}>
                <td style={estiloTdDetalheCelula}>{viagem.caminhao}</td>
                <td style={estiloTdDetalheCelula}>
                  {formatarData(viagem.data)}
                </td>
                <td style={estiloTdDetalheCelula}>{viagem.nf || "-"}</td>
                <td style={estiloTdDetalheCelula}>
                  {formatarNumero(viagem.volFiscal)}
                </td>
                <td style={estiloTdDetalheCelula}>
                  {formatarNumero(viagem.volEntregue)}
                </td>
                <td style={estiloTdDetalheCelula}>
                  {formatarNumero(viagem.diferenca)}
                </td>
                <td style={estiloTdDetalheCelula}>{viagem.cte || "-"}</td>
                <td style={estiloTdDetalheCelula}>C e M Transportadora</td>
                <td style={estiloTdDetalheCelula}>
                  {formatarMoeda(VALOR_POR_VOLUME)}
                </td>
                <td style={estiloTdDetalheCelula}>
                  {formatarMoeda(viagem.valorFiscal)}
                </td>
                <td style={estiloTdDetalheCelula}>
                  {formatarMoeda(viagem.complemento)}
                </td>
                <td style={estiloTdDetalheCelula}>
                  {formatarMoeda(viagem.valorFisico)}
                </td>
                <td style={estiloTdDetalheCelula}>
                  {formatarData(viagem.dataEntrega)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td style={estiloTdDetalheTotal} colSpan={9}>
                Total Geral
              </td>
              <td style={estiloTdDetalheTotal}>
                {formatarMoeda(totalValorFiscal)}
              </td>
              <td style={estiloTdDetalheTotal}>
                {formatarMoeda(totalComplemento)}
              </td>
              <td style={estiloTdDetalheTotal}>
                {formatarMoeda(totalValorFisico)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={estiloAvisoDetalhe}>
        ℹ️ Transportadora e Frete R$/m³ ainda não são cadastrados por viagem —
        aqui é usada a taxa padrão configurada no sistema (
        {formatarMoeda(VALOR_POR_VOLUME)}/m³).
      </p>
    </div>
  );
}

const estiloGridKpis = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const estiloGridGraficos = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "20px",
  marginBottom: "24px",
  alignItems: "stretch",
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
  display: "inline-block",
  width: "16px",
  color: "var(--cor-texto-secundario)",
};

const estiloTdDetalhe = {
  padding: "18px",
  background: "#f9fafb",
  borderBottom: "1px solid var(--cor-borda)",
};

const estiloDetalheVazio = {
  color: "var(--cor-texto-secundario)",
  fontSize: "13px",
  padding: "10px 4px",
};

const estiloResumoDetalhe = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const estiloCardResumoDetalhe = {
  background: "white",
  border: "1px solid var(--cor-borda)",
  borderLeft: "4px solid",
  borderRadius: "var(--raio-pequeno)",
  padding: "12px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const estiloLabelResumoDetalhe = {
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--cor-texto-secundario)",
};

const estiloTabelaDetalheContainer = {
  overflowX: "auto",
  border: "1px solid var(--cor-borda)",
  borderRadius: "10px",
  background: "white",
};

const estiloTabelaDetalhe = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1200px",
};

const estiloThDetalhe = {
  background: "#f3f5f9",
  color: "var(--cor-texto-secundario)",
  padding: "10px 12px",
  textAlign: "left",
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--cor-borda)",
};

const estiloTdDetalheCelula = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--cor-borda)",
  whiteSpace: "nowrap",
  fontSize: "13px",
};

const estiloTdDetalheTotal = {
  padding: "10px 12px",
  whiteSpace: "nowrap",
  fontWeight: "bold",
  background: "#f3f5f9",
  fontSize: "13px",
};

const estiloAvisoDetalhe = {
  marginTop: "12px",
  fontSize: "12px",
  color: "var(--cor-texto-secundario)",
};

export default Dashboard;
