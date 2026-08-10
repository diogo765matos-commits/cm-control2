// Gráfico de rosca simples, feito com SVG puro (sem biblioteca externa).
// segmentos: [{ nome, valor, cor }]

function DonutChart({ segmentos, valorTotal, formatarValor }) {
  const raio = 70;
  const espessura = 26;
  const circunferencia = 2 * Math.PI * raio;
  const semDados = !valorTotal || valorTotal <= 0;

  let acumulado = 0;

  return (
    <div style={estiloContainer}>
      <svg viewBox="0 0 200 200" width="180" height="180" style={{ flexShrink: 0 }}>
        <g transform="translate(100,100) rotate(-90)">
          {semDados ? (
            <circle
              r={raio}
              cx={0}
              cy={0}
              fill="transparent"
              stroke="#eef0f4"
              strokeWidth={espessura}
            />
          ) : (
            segmentos
              .filter((segmento) => segmento.valor > 0)
              .map((segmento, i) => {
                const fracao = segmento.valor / valorTotal;
                const comprimento = fracao * circunferencia;
                const dasharray = `${comprimento} ${circunferencia - comprimento}`;
                const dashoffset = -acumulado;
                acumulado += comprimento;

                return (
                  <circle
                    key={i}
                    r={raio}
                    cx={0}
                    cy={0}
                    fill="transparent"
                    stroke={segmento.cor}
                    strokeWidth={espessura}
                    strokeDasharray={dasharray}
                    strokeDashoffset={dashoffset}
                  />
                );
              })
          )}
        </g>

        <text x="100" y="96" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#111827">
          {formatarValor(valorTotal)}
        </text>
        <text x="100" y="116" textAnchor="middle" fontSize="11" fill="#6b7280">
          Total
        </text>
      </svg>

      <div style={estiloLegenda}>
        {segmentos.map((segmento, i) => (
          <div key={i} style={estiloItemLegenda}>
            <span style={{ ...estiloPonto, background: segmento.cor }} />

            <div style={{ minWidth: 0 }}>
              <strong style={estiloNome}>{segmento.nome}</strong>

              <div style={estiloValores}>
                <span>{formatarValor(segmento.valor)}</span>
                <span style={estiloPercentual}>
                  {valorTotal > 0
                    ? `${((segmento.valor / valorTotal) * 100)
                        .toFixed(2)
                        .replace(".", ",")}%`
                    : "0%"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const estiloContainer = {
  display: "flex",
  alignItems: "center",
  gap: "24px",
  flexWrap: "wrap",
};

const estiloLegenda = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  minWidth: 0,
};

const estiloItemLegenda = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
};

const estiloPonto = {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  marginTop: "5px",
  flexShrink: 0,
};

const estiloNome = {
  fontSize: "14px",
  color: "var(--cor-texto)",
};

const estiloValores = {
  display: "flex",
  gap: "10px",
  fontSize: "13px",
  color: "var(--cor-texto-secundario)",
};

const estiloPercentual = {
  fontWeight: "600",
  color: "var(--cor-texto)",
};

export default DonutChart;
