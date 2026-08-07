import { useEffect, useState } from "react";
import {
  getSemanasDespesasGerais,
  criarSemanaDespesasGerais,
  adicionarDespesaGeral,
  excluirDespesaGeral,
  excluirSemanaDespesasGerais,
} from "../data/despesasGerais";
import { formatarData } from "../utils/formatadores";

function DespesasExtras() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [semanas, setSemanas] = useState([]);
  const [semanaAberta, setSemanaAberta] = useState(null);

  const [mostrarNovaSemana, setMostrarNovaSemana] = useState(false);
  const [inicioSemana, setInicioSemana] = useState("");
  const [fimSemana, setFimSemana] = useState("");

  const [novaDespesa, setNovaDespesa] = useState({
    data: "",
    descricao: "",
    valor: "",
  });

  async function carregar() {
    setCarregando(true);

    try {
      const dados = await getSemanasDespesasGerais();
      setSemanas(dados);
      setErro("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criarSemana() {
    if (!inicioSemana || !fimSemana) {
      alert("Informe o início e o fim da semana.");
      return;
    }

    try {
      const nova = await criarSemanaDespesasGerais(inicioSemana, fimSemana);
      setSemanas((atuais) => [nova, ...atuais]);
      setInicioSemana("");
      setFimSemana("");
      setMostrarNovaSemana(false);
    } catch (e) {
      alert("Não foi possível criar a semana: " + e.message);
    }
  }

  async function adicionarDespesa() {
    if (!novaDespesa.data || !novaDespesa.descricao || !novaDespesa.valor) {
      alert("Preencha todos os campos da despesa.");
      return;
    }

    if (!semanaAberta) {
      alert("Abra uma semana antes de cadastrar uma despesa.");
      return;
    }

    try {
      const atualizada = await adicionarDespesaGeral(semanaAberta, {
        data: novaDespesa.data,
        descricao: novaDespesa.descricao,
        valor: Number(novaDespesa.valor),
      });

      setSemanas((atuais) =>
        atuais.map((semana) =>
          semana.id === atualizada.id ? atualizada : semana
        )
      );

      setSemanaAberta(atualizada);

      setNovaDespesa({ data: "", descricao: "", valor: "" });
    } catch (e) {
      alert("Não foi possível salvar a despesa: " + e.message);
    }
  }

  async function excluirDespesa(idDespesa) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir esta despesa?"
    );

    if (!confirmar) return;

    try {
      const atualizada = await excluirDespesaGeral(semanaAberta, idDespesa);

      setSemanas((atuais) =>
        atuais.map((semana) =>
          semana.id === atualizada.id ? atualizada : semana
        )
      );

      setSemanaAberta(atualizada);
    } catch (e) {
      alert("Não foi possível excluir a despesa: " + e.message);
    }
  }

  async function excluirSemana(idSemana) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir esta semana e todas as despesas cadastradas nela?"
    );

    if (!confirmar) return;

    try {
      await excluirSemanaDespesasGerais(idSemana);

      setSemanas((atuais) =>
        atuais.filter((semana) => semana.id !== idSemana)
      );

      setSemanaAberta(null);
    } catch (e) {
      alert("Não foi possível excluir a semana: " + e.message);
    }
  }

  if (carregando) {
    return <p>Carregando...</p>;
  }

  if (erro) {
    return (
      <p style={{ color: "#dc3545" }}>Erro ao carregar despesas: {erro}</p>
    );
  }

  return (
    <div>
      <div style={estiloContainer}>
        <h1>Despesas Extras</h1>

        <p style={estiloLegenda}>
          Despesas gerais da empresa, sem ligação com um caminhão
          específico.
        </p>

        {!semanaAberta ? (
          <>
            <div style={estiloCabecalhoSecao}>
              <div>
                <h2>Semanas</h2>

                <p style={estiloLegenda}>
                  Organize as despesas por período semanal.
                </p>
              </div>

              <button
                style={estiloBotaoDourado}
                onClick={() => setMostrarNovaSemana(true)}
              >
                + Nova Semana
              </button>
            </div>

            {mostrarNovaSemana && (
              <div style={estiloFormulario}>
                <h3>Nova Semana</h3>

                <div style={estiloCampos}>
                  <Campo
                    titulo="Início"
                    type="date"
                    value={inicioSemana}
                    onChange={(e) => setInicioSemana(e.target.value)}
                  />

                  <Campo
                    titulo="Fim"
                    type="date"
                    value={fimSemana}
                    onChange={(e) => setFimSemana(e.target.value)}
                  />
                </div>

                <div style={estiloAcoesFormulario}>
                  <button
                    style={estiloBotaoCancelar}
                    onClick={() => setMostrarNovaSemana(false)}
                  >
                    Cancelar
                  </button>

                  <button style={estiloBotaoDourado} onClick={criarSemana}>
                    Salvar Semana
                  </button>
                </div>
              </div>
            )}

            {semanas.length === 0 ? (
              <div style={estiloVazio}>
                <h3>Nenhuma semana cadastrada</h3>

                <p>
                  Clique em "+ Nova Semana" para começar a lançar despesas.
                </p>
              </div>
            ) : (
              <div style={estiloListaSemanas}>
                {semanas.map((semana) => (
                  <div key={semana.id} style={estiloSemana}>
                    <div>
                      <p style={estiloLegenda}>Período</p>

                      <h3>
                        {formatarData(semana.inicio)} até{" "}
                        {formatarData(semana.fim)}
                      </h3>

                      <p style={estiloQuantidade}>
                        {semana.despesas.length}{" "}
                        {semana.despesas.length === 1
                          ? "despesa"
                          : "despesas"}
                      </p>
                    </div>

                    <button
                      style={estiloBotaoEscuro}
                      onClick={() => setSemanaAberta(semana)}
                    >
                      Abrir →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={estiloCabecalhoSecao}>
              <div>
                <button
                  style={estiloBotaoVoltarSemana}
                  onClick={() => setSemanaAberta(null)}
                >
                  ← Voltar para semanas
                </button>

                <h2>
                  {formatarData(semanaAberta.inicio)} até{" "}
                  {formatarData(semanaAberta.fim)}
                </h2>

                <p style={estiloLegenda}>
                  {semanaAberta.despesas.length}{" "}
                  {semanaAberta.despesas.length === 1
                    ? "despesa cadastrada"
                    : "despesas cadastradas"}
                </p>
              </div>

              <button
                onClick={() => excluirSemana(semanaAberta.id)}
                style={{
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                🗑 Excluir Semana
              </button>
            </div>

            <div style={estiloFormulario}>
              <h3>Nova Despesa</h3>

              <div style={estiloCampos}>
                <Campo
                  titulo="Data"
                  type="date"
                  value={novaDespesa.data}
                  onChange={(e) =>
                    setNovaDespesa({ ...novaDespesa, data: e.target.value })
                  }
                />

                <Campo
                  titulo="Descrição"
                  placeholder="Ex: Aluguel, escritório, contador..."
                  value={novaDespesa.descricao}
                  onChange={(e) =>
                    setNovaDespesa({
                      ...novaDespesa,
                      descricao: e.target.value,
                    })
                  }
                />

                <Campo
                  titulo="Valor"
                  type="number"
                  placeholder="R$ 0,00"
                  value={novaDespesa.valor}
                  onChange={(e) =>
                    setNovaDespesa({ ...novaDespesa, valor: e.target.value })
                  }
                />
              </div>

              <div style={estiloAcoesFormulario}>
                <button style={estiloBotaoDourado} onClick={adicionarDespesa}>
                  + Adicionar Despesa
                </button>
              </div>
            </div>

            {semanaAberta.despesas.length === 0 ? (
              <div style={estiloVazio}>
                <h3>Nenhuma despesa nesta semana</h3>

                <p>
                  Use o formulário acima para lançar a primeira despesa da
                  semana.
                </p>
              </div>
            ) : (
              <div>
                <h3 style={{ marginBottom: "20px" }}>
                  Total: R${" "}
                  {semanaAberta.despesas
                    .reduce(
                      (total, despesa) => total + Number(despesa.valor || 0),
                      0
                    )
                    .toFixed(2)
                    .replace(".", ",")}
                </h3>

                <div style={estiloTabelaContainer}>
                  <table style={estiloTabela}>
                    <thead>
                      <tr>
                        <th style={estiloTh}>Data</th>
                        <th style={estiloTh}>Descrição</th>
                        <th style={estiloTh}>Valor</th>
                        <th style={estiloTh}>Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {semanaAberta.despesas.map((despesa) => (
                        <tr key={despesa.id}>
                          <td style={estiloTd}>
                            {formatarData(despesa.data)}
                          </td>
                          <td style={estiloTd}>{despesa.descricao}</td>
                          <td style={estiloTd}>
                            R${" "}
                            {Number(despesa.valor).toFixed(2).replace(".", ",")}
                          </td>
                          <td style={estiloTd}>
                            <button
                              onClick={() => excluirDespesa(despesa.id)}
                              style={{
                                background: "#dc3545",
                                color: "white",
                                border: "none",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: "bold",
                              }}
                            >
                              🗑️ Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Campo({ titulo, type = "text", value, onChange, placeholder }) {
  return (
    <label style={estiloLabel}>
      {titulo}

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={estiloInput}
      />
    </label>
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
  margin: "5px 0",
};

const estiloCabecalhoSecao = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "25px",
  marginTop: "10px",
};

const estiloFormulario = {
  background: "#f7f7f7",
  padding: "25px",
  borderRadius: "12px",
  marginBottom: "25px",
};

const estiloCampos = {
  display: "flex",
  gap: "20px",
  marginTop: "20px",
  flexWrap: "wrap",
};

const estiloLabel = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  fontWeight: "600",
  color: "#444",
  minWidth: "200px",
  flex: 1,
};

const estiloInput = {
  padding: "12px",
  border: "1px solid #ccc",
  borderRadius: "8px",
  fontSize: "15px",
  background: "white",
};

const estiloAcoesFormulario = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "20px",
};

const estiloBotaoDourado = {
  background: "#D4A019",
  color: "#111",
  border: "none",
  padding: "12px 20px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold",
};

const estiloBotaoCancelar = {
  background: "#eee",
  color: "#333",
  border: "none",
  padding: "12px 20px",
  borderRadius: "8px",
  cursor: "pointer",
};

const estiloBotaoEscuro = {
  background: "#111",
  color: "white",
  border: "none",
  padding: "12px 20px",
  borderRadius: "8px",
  cursor: "pointer",
};

const estiloBotaoVoltarSemana = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: "0",
  marginBottom: "15px",
  color: "#555",
  fontSize: "14px",
};

const estiloVazio = {
  textAlign: "center",
  padding: "50px 20px",
  background: "#fafafa",
  border: "1px dashed #ccc",
  borderRadius: "12px",
  color: "#777",
};

const estiloListaSemanas = {
  display: "grid",
  gap: "15px",
};

const estiloSemana = {
  border: "1px solid #eee",
  padding: "20px",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
};

const estiloQuantidade = {
  marginTop: "8px",
  color: "#D4A019",
  fontWeight: "bold",
};

const estiloTabelaContainer = {
  overflowX: "auto",
  border: "1px solid #eee",
  borderRadius: "10px",
};

const estiloTabela = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "600px",
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

export default DespesasExtras;
