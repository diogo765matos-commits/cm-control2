import { useState } from "react";

// Filtro de período reutilizável. Mantém um rascunho local dos campos de
// data e só aplica o filtro de verdade quando clica em "Atualizar" — assim
// dá pra escolher início e fim sem re-filtrar a cada tecla.
function DateRangeFilter({ inicio, fim, onAplicar, onLimpar }) {
  const [rascunhoInicio, setRascunhoInicio] = useState(inicio || "");
  const [rascunhoFim, setRascunhoFim] = useState(fim || "");

  const filtroAtivo = Boolean(inicio || fim);

  function aplicar() {
    onAplicar(rascunhoInicio, rascunhoFim);
  }

  function limpar() {
    setRascunhoInicio("");
    setRascunhoFim("");
    onLimpar();
  }

  return (
    <div style={estiloContainer}>
      <div style={estiloCaixaData}>
        <span style={estiloIconeCalendario}>📅</span>

        <input
          type="date"
          value={rascunhoInicio}
          onChange={(e) => setRascunhoInicio(e.target.value)}
          style={estiloInput}
        />

        <span style={estiloAte}>até</span>

        <input
          type="date"
          value={rascunhoFim}
          onChange={(e) => setRascunhoFim(e.target.value)}
          style={estiloInput}
        />
      </div>

      <button style={estiloBotaoAtualizar} onClick={aplicar}>
        Atualizar ⟳
      </button>

      {filtroAtivo && (
        <button style={estiloBotaoLimpar} onClick={limpar}>
          Limpar
        </button>
      )}
    </div>
  );
}

const estiloContainer = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const estiloCaixaData = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "var(--cor-card)",
  border: "1px solid var(--cor-borda)",
  borderRadius: "var(--raio-pequeno)",
  padding: "8px 14px",
};

const estiloIconeCalendario = {
  fontSize: "14px",
};

const estiloAte = {
  color: "var(--cor-texto-secundario)",
  fontSize: "13px",
};

const estiloInput = {
  border: "none",
  fontSize: "14px",
  color: "var(--cor-texto)",
  outline: "none",
  fontFamily: "inherit",
  background: "transparent",
};

const estiloBotaoAtualizar = {
  background: "var(--cor-primaria)",
  color: "white",
  border: "none",
  padding: "10px 18px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const estiloBotaoLimpar = {
  background: "transparent",
  color: "var(--cor-texto-secundario)",
  border: "none",
  cursor: "pointer",
  fontSize: "13px",
  textDecoration: "underline",
};

export default DateRangeFilter;
