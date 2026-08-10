// Card de indicador (KPI) usado no topo das páginas — mesmo componente
// reaproveitado no Painel, na página do caminhão e em Despesas Extras.

export const CORES_KPI = {
  verde: { fundo: "#dcfce7", icone: "#16a34a" },
  azul: { fundo: "#dbeafe", icone: "#2563eb" },
  roxo: { fundo: "#ede9fe", icone: "#7c3aed" },
  laranja: { fundo: "#ffedd5", icone: "#ea580c" },
  dourado: { fundo: "#fef3c7", icone: "#b45309" },
  vermelho: { fundo: "#fee2e2", icone: "#dc2626" },
};

function KpiCard({ icone, cor = CORES_KPI.verde, rotulo, valor, legenda }) {
  return (
    <div style={estiloCard}>
      <div
        style={{
          ...estiloIcone,
          background: cor.fundo,
          color: cor.icone,
        }}
      >
        {icone}
      </div>

      <div style={estiloTextos}>
        <span style={estiloRotulo}>{rotulo}</span>
        <strong style={estiloValor}>{valor}</strong>
        {legenda && <span style={estiloLegenda}>{legenda}</span>}
      </div>
    </div>
  );
}

const estiloCard = {
  background: "var(--cor-card)",
  borderRadius: "var(--raio)",
  boxShadow: "var(--sombra-card)",
  padding: "18px 20px",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  minWidth: 0,
};

const estiloIcone = {
  width: "46px",
  height: "46px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "20px",
  flexShrink: 0,
};

const estiloTextos = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  minWidth: 0,
};

const estiloRotulo = {
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--cor-texto-secundario)",
};

const estiloValor = {
  fontSize: "20px",
  color: "var(--cor-texto)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const estiloLegenda = {
  fontSize: "12px",
  color: "var(--cor-texto-secundario)",
};

export default KpiCard;
