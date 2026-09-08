// Página de detalhe de um período (semana) específico, aberta ao clicar
// numa linha do "Resumo por Período" no Painel. Mostra as viagens (NFs)
// daquela semana em todos os caminhões, além dos gráficos de receita e
// gastos já filtrados só para esse período.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../lib/supabase";
import {
  PERCENTUAL_MOTORISTA,
  VALOR_POR_VOLUME,
  VALOR_POR_TONELADA_BAGACO,
} from "../data/config";
import { taxaDaFrota } from "../data/caminhoes";
import {
  converterNumero,
  formatarData,
  formatarMoeda,
  formatarNumero,
} from "../utils/formatadores";
import PageHeader from "../components/PageHeader";
import KpiCard, { CORES_KPI } from "../components/KpiCard";
import BarChart from "../components/BarChart";
import DonutChart from "../components/DonutChart";

function PeriodoDetalhe() {
  const { inicio, fim } = useParams();
  const navigate = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [viagens, setViagens] = useState([]);
  const [totalCombustivel, setTotalCombustivel] = useState(0);
  const [totalDespesasExtras, setTotalDespesasExtras] = useState(0);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);

      try {
        const [caminhoes, semanasViagens, semanasAbastecimento, semanasDespesas] =
          await Promise.all([
            db.select("caminhoes", "select=id,placa,modelo,frota"),
            db.select(
              "viagens_semanas",
              `select=viagens,caminhao_id&inicio=eq.${inicio}&fim=eq.${fim}`
            ),
            db.select(
              "abastecimento_semanas",
              `select=abastecimentos&inicio=eq.${inicio}&fim=eq.${fim}`
            ),
            db.select(
              "despesas_semanas",
              `select=despesas&inicio=eq.${inicio}&fim=eq.${fim}`
            ),
          ]);

        if (!ativo) return;

        const caminhoesPorId = {};
        caminhoes.forEach((c) => {
          caminhoesPorId[c.id] = c;
        });

        const linhas = [];

        semanasViagens.forEach((semana) => {
          const caminhao = caminhoesPorId[semana.caminhao_id];
          const rotulo = caminhao
            ? `${caminhao.modelo} (${caminhao.placa})`
            : "Caminhão removido";
          const taxa = taxaDaFrota(caminhao?.frota);

          (semana.viagens || []).forEach((viagem) => {
            const volFiscal = converterNumero(viagem.volFiscal) || 0;
            const volEntregue = converterNumero(viagem.volEntregue) || 0;
            const diferenca = volEntregue - volFiscal;

            linhas.push({
              id: viagem.id,
              caminhao: rotulo,
              data: viagem.data,
              nf: viagem.nf,
              cte: viagem.cte,
              volFiscal,
              volEntregue,
              diferenca,
              taxa,
              valorFiscal: volFiscal * taxa,
              complemento: diferenca * taxa,
              valorFisico: volEntregue * taxa,
              dataEntrega: viagem.dataEntrega,
            });
          });
        });

        linhas.sort((a, b) => (a.data < b.data ? -1 : 1));

        let combustivel = 0;
        semanasAbastecimento.forEach((semana) => {
          (semana.abastecimentos || []).forEach((a) => {
            combustivel += a.valorTotal || 0;
          });
        });

        let despesas = 0;
        semanasDespesas.forEach((semana) => {
          (semana.despesas || []).forEach((d) => {
            despesas += Number(d.valor) || 0;
          });
        });

        setViagens(linhas);
        setTotalCombustivel(combustivel);
        setTotalDespesasExtras(despesas);
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
  }, [inicio, fim]);

  if (carregando) {
    return <p>Carregando período...</p>;
  }

  if (erro) {
    return (
      <p style={{ color: "#dc3545" }}>Erro ao carregar o período: {erro}</p>
    );
  }

  const totalViagens = viagens.length;
  const volumeEntregueTotal = viagens.reduce((s, v) => s + v.volEntregue, 0);
  const receitaBrutaTotal = viagens.reduce((s, v) => s + v.valorFisico, 0);
  const pagamentoMotoristas = receitaBrutaTotal * PERCENTUAL_MOTORISTA;
  const gastos = totalCombustivel + totalDespesasExtras + pagamentoMotoristas;
  const lucro = receitaBrutaTotal - gastos;

  const totalValorFiscal = viagens.reduce((s, v) => s + v.valorFiscal, 0);
  const totalComplemento = viagens.reduce((s, v) => s + v.complemento, 0);
  const totalValorFisico = viagens.reduce((s, v) => s + v.valorFisico, 0);

  const receitaPorCaminhaoMapa = new Map();
  viagens.forEach((v) => {
    const atual = receitaPorCaminhaoMapa.get(v.caminhao) || 0;
    receitaPorCaminhaoMapa.set(v.caminhao, atual + v.valorFisico);
  });
  const dadosReceitaPorCaminhao = Array.from(
    receitaPorCaminhaoMapa,
    ([label, value]) => ({ label, value })
  );

  const custoTotal = totalCombustivel + totalDespesasExtras;

  return (
    <div>
      <PageHeader
        breadcrumb={
          <button onClick={() => navigate("/")} style={estiloLinkBreadcrumb}>
            ← Painel
          </button>
        }
        titulo={`Período: ${formatarData(inicio)} até ${formatarData(fim)}`}
        subtitulo="Viagens e desempenho financeiro desta semana, em todos os caminhões."
      />

      <div style={estiloGridKpis}>
        <KpiCard
          icone="🚚"
          cor={CORES_KPI.verde}
          rotulo="Viagens"
          valor={totalViagens}
          legenda="Nesta semana"
        />
        <KpiCard
          icone="💰"
          cor={CORES_KPI.verde}
          rotulo="Receita Bruta"
          valor={formatarMoeda(receitaBrutaTotal)}
          legenda="Nesta semana"
        />
        <KpiCard
          icone="⛽"
          cor={CORES_KPI.roxo}
          rotulo="Combustível"
          valor={formatarMoeda(totalCombustivel)}
          legenda="Nesta semana"
        />
        <KpiCard
          icone="🧾"
          cor={CORES_KPI.laranja}
          rotulo="Despesas Extras"
          valor={formatarMoeda(totalDespesasExtras)}
          legenda="Nesta semana"
        />
        <KpiCard
          icone="🧑‍✈️"
          cor={CORES_KPI.dourado}
          rotulo="Motoristas (10%)"
          valor={formatarMoeda(pagamentoMotoristas)}
          legenda="Nesta semana"
        />
        <KpiCard
          icone="📈"
          cor={CORES_KPI.verde}
          rotulo="Lucro da Frota"
          valor={formatarMoeda(lucro)}
          legenda="Nesta semana"
        />
      </div>

      <div style={estiloGridGraficos}>
        <div style={estiloCard}>
          <h3 style={estiloTituloCard}>Receita Bruta por Caminhão</h3>
          <BarChart dados={dadosReceitaPorCaminhao} formatarValor={formatarMoeda} />
        </div>

        <div style={estiloCard}>
          <h3 style={estiloTituloCard}>Distribuição de Gastos</h3>
          <DonutChart
            valorTotal={custoTotal}
            formatarValor={formatarMoeda}
            segmentos={[
              { nome: "Combustível", valor: totalCombustivel, cor: "#2563eb" },
              {
                nome: "Despesas Extras",
                valor: totalDespesasExtras,
                cor: "#16a34a",
              },
            ]}
          />
        </div>
      </div>

      <div style={estiloCard}>
        <h3 style={estiloTituloCard}>Viagens da Semana</h3>

        {viagens.length === 0 ? (
          <div style={estiloVazio}>
            <h3>Nenhuma viagem lançada neste período ainda.</h3>
          </div>
        ) : (
          <>
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

            <div style={estiloTabelaContainer}>
              <table style={estiloTabela}>
                <thead>
                  <tr>
                    <th style={estiloTh}>Caminhão</th>
                    <th style={estiloTh}>Data NF</th>
                    <th style={estiloTh}>Nº NF</th>
                    <th style={estiloTh}>Vol. Fiscal</th>
                    <th style={estiloTh}>Vol. Entregue</th>
                    <th style={estiloTh}>Diferença</th>
                    <th style={estiloTh}>CT-e</th>
                    <th style={estiloTh}>Transportadora</th>
                    <th style={estiloTh}>Frete R$/Unid.</th>
                    <th style={estiloTh}>Valor Fiscal</th>
                    <th style={estiloTh}>Complemento</th>
                    <th style={estiloTh}>Valor Físico</th>
                    <th style={estiloTh}>Data Transporte</th>
                  </tr>
                </thead>

                <tbody>
                  {viagens.map((viagem) => (
                    <tr key={viagem.id}>
                      <td style={estiloTd}>{viagem.caminhao}</td>
                      <td style={estiloTd}>{formatarData(viagem.data)}</td>
                      <td style={estiloTd}>{viagem.nf || "-"}</td>
                      <td style={estiloTd}>{formatarNumero(viagem.volFiscal)}</td>
                      <td style={estiloTd}>{formatarNumero(viagem.volEntregue)}</td>
                      <td style={estiloTd}>{formatarNumero(viagem.diferenca)}</td>
                      <td style={estiloTd}>{viagem.cte || "-"}</td>
                      <td style={estiloTd}>C e M Transportadora</td>
                      <td style={estiloTd}>{formatarMoeda(viagem.taxa)}</td>
                      <td style={estiloTd}>{formatarMoeda(viagem.valorFiscal)}</td>
                      <td style={estiloTd}>{formatarMoeda(viagem.complemento)}</td>
                      <td style={estiloTd}>{formatarMoeda(viagem.valorFisico)}</td>
                      <td style={estiloTd}>{formatarData(viagem.dataEntrega)}</td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td style={estiloTdTotal} colSpan={9}>
                      Total Geral
                    </td>
                    <td style={estiloTdTotal}>{formatarMoeda(totalValorFiscal)}</td>
                    <td style={estiloTdTotal}>{formatarMoeda(totalComplemento)}</td>
                    <td style={estiloTdTotal}>{formatarMoeda(totalValorFisico)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p style={estiloAviso}>
              ℹ️ Transportadora e Frete ainda não são cadastrados por viagem —
              aqui é usada a taxa padrão da frota de cada caminhão (
              {formatarMoeda(VALOR_POR_VOLUME)}/m³ para C&M e Terceirizada,{" "}
              {formatarMoeda(VALOR_POR_TONELADA_BAGACO)}/ton para Bagaço de
              Cana).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const estiloLinkBreadcrumb = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  color: "var(--cor-texto-secundario)",
  fontSize: "13px",
  textDecoration: "underline",
};

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

const estiloVazio = {
  textAlign: "center",
  padding: "50px 20px",
  background: "#fafafa",
  border: "1px dashed #ccc",
  borderRadius: "12px",
  color: "#777",
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

const estiloTabelaContainer = {
  overflowX: "auto",
  border: "1px solid var(--cor-borda)",
  borderRadius: "10px",
};

const estiloTabela = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1200px",
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
  padding: "12px 14px",
  borderBottom: "1px solid var(--cor-borda)",
  whiteSpace: "nowrap",
  fontSize: "13px",
};

const estiloTdTotal = {
  padding: "12px 14px",
  whiteSpace: "nowrap",
  fontWeight: "bold",
  background: "#f9fafb",
  borderTop: "2px solid var(--cor-borda)",
  fontSize: "13px",
};

const estiloAviso = {
  marginTop: "14px",
  fontSize: "12px",
  color: "var(--cor-texto-secundario)",
};

export default PeriodoDetalhe;
