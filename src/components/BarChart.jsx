// Gráfico de barras simples, feito com SVG puro (sem biblioteca externa).

function proximoNumeroRedondo(valor) {
  if (valor <= 0) return 100;

  const expoente = Math.floor(Math.log10(valor));
  const base = Math.pow(10, expoente);
  const normalizado = valor / base;

  let multiplicador;
  if (normalizado <= 1) multiplicador = 1;
  else if (normalizado <= 2) multiplicador = 2;
  else if (normalizado <= 5) multiplicador = 5;
  else multiplicador = 10;

  return multiplicador * base;
}

function BarChart({ dados, formatarValor, corBarra = "#34d399" }) {
  if (!dados || dados.length === 0) {
    return <p style={estiloVazio}>Sem dados no período selecionado.</p>;
  }

  const valorMaximoDados = Math.max(...dados.map((d) => d.value), 0);
  const maximoEscala = proximoNumeroRedondo(valorMaximoDados || 1);
  const passos = 4;

  const larguraBarra = 46;
  const espacoBarra = 90;
  const alturaGrafico = 210;
  const margemEsquerda = 64;
  const largura = Math.max(dados.length * espacoBarra + margemEsquerda + 20, 320);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${largura} ${alturaGrafico + 60}`}
        width="100%"
        height={alturaGrafico + 60}
        style={{ display: "block", minWidth: `${largura}px` }}
      >
        {Array.from({ length: passos + 1 }).map((_, i) => {
          const valor = (maximoEscala / passos) * i;
          const y = alturaGrafico - (valor / maximoEscala) * alturaGrafico + 20;

          return (
            <g key={i}>
              <line
                x1={margemEsquerda}
                x2={largura - 10}
                y1={y}
                y2={y}
                stroke="#eef0f4"
                strokeWidth={1}
              />
              <text x={margemEsquerda - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#9aa3b2">
                {formatarValor(valor)}
              </text>
            </g>
          );
        })}

        {dados.map((item, i) => {
          const altura =
            maximoEscala > 0 ? (item.value / maximoEscala) * alturaGrafico : 0;
          const x = margemEsquerda + i * espacoBarra;
          const y = alturaGrafico - altura + 20;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={larguraBarra}
                height={Math.max(altura, 1)}
                rx={6}
                fill={corBarra}
              />
              <text
                x={x + larguraBarra / 2}
                y={y - 8}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#111827"
              >
                {formatarValor(item.value)}
              </text>
              <text
                x={x + larguraBarra / 2}
                y={alturaGrafico + 38}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const estiloVazio = {
  color: "var(--cor-texto-secundario)",
  padding: "40px 0",
  textAlign: "center",
};

export default BarChart;
