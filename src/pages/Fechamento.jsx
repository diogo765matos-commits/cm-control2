import { useState } from "react";
import { getCaminhoes } from "../data/caminhoes";
import { VALOR_POR_VOLUME, PERCENTUAL_MOTORISTA } from "../data/config";
import {
  converterNumero,
  formatarData,
  formatarMoeda,
  formatarNumero,
} from "../utils/formatadores";

// =========================
// DADOS
// =========================

function carregarSemanasDoCaminhao(placa) {
  const salvo = localStorage.getItem(`viagens-semanas-${placa}`);
  return salvo ? JSON.parse(salvo) : [];
}

function calcularSemana(semana) {
  const volumeEntregue = semana.viagens.reduce(
    (total, viagem) => total + (converterNumero(viagem.volEntregue) || 0),
    0
  );

  const valorBruto = volumeEntregue * VALOR_POR_VOLUME;
  const pagamentoMotorista = valorBruto * PERCENTUAL_MOTORISTA;
  const valorEmpresa = valorBruto - pagamentoMotorista;

  return { volumeEntregue, valorBruto, pagamentoMotorista, valorEmpresa };
}

function Fechamento() {
  const [pesquisaInicio, setPesquisaInicio] = useState("");
  const [pesquisaFim, setPesquisaFim] = useState("");

  const caminhoes = getCaminhoes();

  const dadosPorCaminhao = caminhoes
    .map((caminhao) => {
      const semanas = carregarSemanasDoCaminhao(caminhao.placa)
        .filter((semana) => {
          if (pesquisaInicio && semana.fim < pesquisaInicio) return false;
          if (pesquisaFim && semana.inicio > pesquisaFim) return false;
          return true;
        })
        .map((semana) => ({ ...semana, ...calcularSemana(semana) }))
        .sort((a, b) => (a.inicio < b.inicio ? 1 : -1));

      return { caminhao, semanas };
    })
    .filter((item) => item.semanas.length > 0);

  const totalGeral = dadosPorCaminhao.reduce(
    (total, item) => {
      item.semanas.forEach((semana) => {
        total.volumeEntregue += semana.volumeEntregue;
        total.valorBruto += semana.valorBruto;
        total.pagamentoMotorista += semana.pagamentoMotorista;
        total.valorEmpresa += semana.valorEmpresa;
      });

      return total;
    },
    { volumeEntregue: 0, valorBruto: 0, pagamentoMotorista: 0, valorEmpresa: 0 }
  );

  return (
    <div>
      <h1>Fechamento Semanal</h1>

      <p style={estiloLegenda}>
        Volume entregue, valor bruto ({formatarMoeda(VALOR_POR_VOLUME)} por
        volume) e pagamento do motorista ({PERCENTUAL_MOTORISTA * 100}%),
        organizados por caminhão e por semana.
      </p>

      <div style={estiloFiltro}>
        <Campo
          titulo="Pesquisar de"
          type="date"
          value={pesquisaInicio}
          onChange={(e) => setPesquisaInicio(e.target.value)}
        />

        <Campo
          titulo="Até"
          type="date"
          value={pesquisaFim}
          onChange={(e) => setPesquisaFim(e.target.value)}
        />
      </div>

      {dadosPorCaminhao.length === 0 ? (
        <div style={estiloVazio}>
          <h3>Nenhuma semana encontrada</h3>

          <p>
            Cadastre viagens em um caminhão (aba "Viagens") ou ajuste o
            período pesquisado acima.
          </p>
        </div>
      ) : (
        <>
          <div style={estiloCardsResumo}>
            <CardResumo
              titulo="Volume Total Entregue"
              valor={`${formatarNumero(totalGeral.volumeEntregue)} m³`}
            />

            <CardResumo
              titulo="Valor Bruto Total"
              valor={formatarMoeda(totalGeral.valorBruto)}
            />

            <CardResumo
              titulo="Total Motoristas"
              valor={formatarMoeda(totalGeral.pagamentoMotorista)}
            />

            <CardResumo
              titulo="Fica para a Empresa"
              valor={formatarMoeda(totalGeral.valorEmpresa)}
            />
          </div>

          {dadosPorCaminhao.map(({ caminhao, semanas }) => {
            const subtotal = semanas.reduce(
              (total, semana) => {
                total.volumeEntregue += semana.volumeEntregue;
                total.valorBruto += semana.valorBruto;
                total.pagamentoMotorista += semana.pagamentoMotorista;
                total.valorEmpresa += semana.valorEmpresa;
                return total;
              },
              {
                volumeEntregue: 0,
                valorBruto: 0,
                pagamentoMotorista: 0,
                valorEmpresa: 0,
              }
            );

            return (
              <div key={caminhao.id} style={estiloContainer}>
                <div style={estiloCabecalhoCaminhao}>
                  <h2>🚛 {caminhao.modelo}</h2>

                  <p style={estiloLegenda}>
                    Placa: <strong>{caminhao.placa}</strong> · Motorista:{" "}
                    <strong>{caminhao.motorista}</strong>
                  </p>
                </div>

                <div style={estiloTabelaContainer}>
                  <table style={estiloTabela}>
                    <thead>
                      <tr>
                        <th style={estiloTh}>Semana</th>
                        <th style={estiloTh}>Viagens</th>
                        <th style={estiloTh}>Volume Entregue</th>
                        <th style={estiloTh}>Valor Bruto</th>
                        <th style={estiloTh}>Motorista (10%)</th>
                        <th style={estiloTh}>Fica p/ Empresa</th>
                      </tr>
                    </thead>

                    <tbody>
                      {semanas.map((semana) => (
                        <tr key={semana.id}>
                          <td style={estiloTd}>
                            {formatarData(semana.inicio)} até{" "}
                            {formatarData(semana.fim)}
                          </td>

                          <td style={estiloTd}>{semana.viagens.length}</td>

                          <td style={estiloTd}>
                            {formatarNumero(semana.volumeEntregue)}
                          </td>

                          <td style={estiloTd}>
                            {formatarMoeda(semana.valorBruto)}
                          </td>

                          <td style={estiloTd}>
                            {formatarMoeda(semana.pagamentoMotorista)}
                          </td>

                          <td style={estiloTd}>
                            {formatarMoeda(semana.valorEmpresa)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr>
                        <td style={estiloTdSubtotal}>Subtotal</td>

                        <td style={estiloTdSubtotal}>
                          {semanas.reduce(
                            (total, semana) => total + semana.viagens.length,
                            0
                          )}
                        </td>

                        <td style={estiloTdSubtotal}>
                          {formatarNumero(subtotal.volumeEntregue)}
                        </td>

                        <td style={estiloTdSubtotal}>
                          {formatarMoeda(subtotal.valorBruto)}
                        </td>

                        <td style={estiloTdSubtotal}>
                          {formatarMoeda(subtotal.pagamentoMotorista)}
                        </td>

                        <td style={estiloTdSubtotal}>
                          {formatarMoeda(subtotal.valorEmpresa)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// =========================
// COMPONENTES
// =========================

function Campo({ titulo, type = "text", value, onChange }) {
  return (
    <label style={estiloLabel}>
      {titulo}

      <input
        type={type}
        value={value}
        onChange={onChange}
        style={estiloInput}
      />
    </label>
  );
}

function CardResumo({ titulo, valor }) {
  return (
    <div style={estiloCardResumo}>
      <span style={estiloLegenda}>{titulo}</span>

      <strong style={estiloNumeroResumo}>{valor}</strong>
    </div>
  );
}

// =========================
// ESTILOS
// =========================

const estiloLegenda = {
  color: "#777",
  margin: "5px 0",
};

const estiloFiltro = {
  display: "flex",
  gap: "15px",
  marginTop: "20px",
  marginBottom: "30px",
  flexWrap: "wrap",
};

const estiloLabel = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  fontWeight: "600",
  color: "#444",
};

const estiloInput = {
  padding: "12px",
  border: "1px solid #ccc",
  borderRadius: "8px",
  fontSize: "15px",
  background: "white",
};

const estiloVazio = {
  textAlign: "center",
  padding: "50px 20px",
  background: "#fafafa",
  border: "1px dashed #ccc",
  borderRadius: "12px",
  color: "#777",
};

const estiloCardsResumo = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "20px",
  marginBottom: "35px",
};

const estiloCardResumo = {
  border: "1px solid #eee",
  borderRadius: "12px",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  background: "white",
};

const estiloNumeroResumo = {
  fontSize: "24px",
  color: "#D4A019",
};

const estiloContainer = {
  background: "white",
  padding: "25px",
  borderRadius: "15px",
  boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
  marginBottom: "25px",
};

const estiloCabecalhoCaminhao = {
  marginBottom: "20px",
};

const estiloTabelaContainer = {
  overflowX: "auto",
  border: "1px solid #eee",
  borderRadius: "10px",
};

const estiloTabela = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "800px",
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

const estiloTdSubtotal = {
  padding: "14px",
  fontWeight: "bold",
  background: "#f7f7f7",
  whiteSpace: "nowrap",
};

export default Fechamento;
