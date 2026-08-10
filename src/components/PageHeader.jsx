function PageHeader({ breadcrumb, titulo, subtitulo, children }) {
  return (
    <div style={estiloHeader}>
      <div>
        {breadcrumb && <div style={estiloBreadcrumb}>{breadcrumb}</div>}
        <h1 style={estiloTitulo}>{titulo}</h1>
        {subtitulo && <p style={estiloSubtitulo}>{subtitulo}</p>}
      </div>

      {children && <div style={estiloControles}>{children}</div>}
    </div>
  );
}

const estiloHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
  gap: "16px",
  marginBottom: "28px",
};

const estiloBreadcrumb = {
  color: "var(--cor-texto-secundario)",
  fontSize: "13px",
  marginBottom: "4px",
};

const estiloTitulo = {
  fontSize: "26px",
  margin: 0,
};

const estiloSubtitulo = {
  color: "var(--cor-texto-secundario)",
  marginTop: "4px",
};

const estiloControles = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

export default PageHeader;
