import { useEffect, useState } from "react";
import { db } from "../lib/supabase";
import { VALOR_POR_VOLUME, PERCENTUAL_MOTORISTA } from "../data/config";
import {
  converterNumero,
  formatarData,
  formatarMoeda,
  formatarNumero,
} from "../utils/formatadores";

function chavePeriodo(inicio, fim) {
  return `${inicio}_${fim}`;
}

async function calcularResumoPorPeriodo() {
  const [caminhoes, semanasViagens, semanasAbastecimento, semanasDespesas] =
    await Promise.all([
      db.select("caminhoes", "select=id"),
      db.select("viagens_semanas", "select=inicio,fim,viagens"),
      db.select("abastecimento_semanas", "select=inicio,fim,abastecimentos"),
      db.select("despesas_semanas", "select=inicio,fim,despesas"),
    ]);

  const periodos = new Map();

  function pegarPeriodo(inicio, fim) {
    const chave = chavePeriodo(inicio, fim);

    if (!periodos.has(chave)) {
      periodos.set(chave, {
        inicio,
        fim,
        totalViagens: 0,
        volumeEntregue: 0,
        totalCombustivel: 0,
        totalDespesasExtras: 0,
      });
    }

    return periodos.get(chave);
  }

  semanasViagens.forEach((semana) => {
    const periodo = pegarPeriodo(semana.inicio, semana.fim);
    periodo.totalViagens += semana.viagens.length;

    semana.viagens.forEach((viagem) => {
      periodo.volumeEntregue += converterNumero(viagem.volEntregue) || 0;
    });
  });

  semanasAbastecimento.forEach((semana) => {
    const periodo = pegarPeriodo(semana.inicio, semana.fim);

    semana.abastecimentos.forEach((abastecimento) => {
      periodo.totalCombustivel += abastecimento.valorTotal || 0;
    });
  });

  semanasDespesas.forEach((semana) => {
    const periodo = pegarPeriodo(semana.inicio, semana.fim);

    semana.despesas.forEach((despesa) => {
      periodo.totalDespesasExtras += Number(despesa.valor) || 0;
    });
  });

  const lista = Array.from(periodos.values())
    .map((periodo) => {
      const receitaBruta = periodo.volumeEntregue * VALOR_POR_VOLUME;
      const pagamentoMotoristas = receitaBruta * PERCENTUAL_MOTORISTA;
      const gastos =
        periodo.totalCombustivel +
        periodo.totalDespesasExtras +
        pagamentoMotoristas;
      const lucro = receitaBruta - gastos;

      return {
        ...periodo,
        receitaBruta,
        pagamentoMotoristas,
        gastos,
        lucro,
      };
    })
    .sort((a, b) => (a.inicio < b.inicio ? 1 : -1));

  return { periodos: lista, totalCaminhoes: caminhoes.length };
}

function Dashboard() {
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    calcularResumoPorPeriodo()
      .then((dados) => {
        if (ativo) setResumo(dados);
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      });

    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <p style={{ color: "#dc3545" }}>Erro ao carregar o painel: {erro}</p>
    );
  }

  if (!resumo) {
    return <p>Carregando...</p>;
  }

  const totalGeral = resumo.periodos.reduce(
    (soma, periodo) => ({
      totalViagens: soma.totalViagens + periodo.totalViagens,
      volumeEntregue: soma.volumeEntregue + periodo.volumeEntregue,
      receitaBruta: soma.receitaBruta + periodo.receitaBruta,
      totalCombustivel: soma.totalCombustivel + periodo.totalCombustivel,
      totalDespesasExtras:
        soma.totalDespesasExtras + periodo.totalDespesasExtras,
      pagamentoMotoristas:
        soma.pagamentoMotoristas + periodo.pagamentoMotoristas,
      lucro: soma.lucro + periodo.lucro,
    }),
    {
      totalViagens: 0,
      volumeEntregue: 0,
      receitaBruta: 0,
      totalCombustivel: 0,
      totalDespesasExtras: 0,
      pagamentoMotoristas: 0,
      lucro: 0,
    }
  );

  return (
    <div style={estiloContainer}>
      <h1>Painel</h1>

      <p style={estiloLegenda}>
        {resumo.totalCaminhoes} caminhão(ões) cadastrado(s). Lucro
        detalhado por período — os períodos são formados pelas semanas que
        você cria em cada caminhão; só se somam no mesmo período quando o
        início e o fim batem exatamente entre os caminhões.
      </p>

      {resumo.periodos.length === 0 ? (
        <div style={estiloVazio}>
          <h3>Nenhuma semana cadastrada ainda</h3>
          <p>
            Lance viagens em algum caminhão (aba "Frota") para ver o
            resultado aqui.
          </p>
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
                <th style={estiloTh}>Lucro da Empresa</th>
              </tr>
            </thead>

            <tbody>
              {resumo.periodos.map((periodo) => (
                <tr key={chavePeriodo(periodo.inicio, periodo.fim)}>
                  <td style={estiloTd}>
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
                      color: periodo.lucro < 0 ? "#dc3545" : "#111",
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
                    color: totalGeral.lucro < 0 ? "#dc3545" : "#D4A019",
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
  );
}

const estiloContainer = {
  background: "white",
  padding: "30px",
  borderRadius: "15px",
  boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
};

const estiloLegenda = {
  color: "#777",
  margin: "10px 0 25px",
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
  border: "1px solid #eee",
  borderRadius: "10px",
};

const estiloTabela = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "950px",
};

const estiloTh = {
  background: "#111",
  color: "white",
  padding: "14px",
  textAlign: "left",
  fontSize: "14px",
  whiteSpace: "nowrap",
};

const estiloTd = {
  padding: "14px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};

const estiloTdTotal = {
  padding: "14px",
  whiteSpace: "nowrap",
  fontWeight: "bold",
  background: "#f7f7f7",
  borderTop: "2px solid #ddd",
};

export default Dashboard;
