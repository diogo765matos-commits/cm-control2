import { useEffect, useState } from "react";
import {
  getDespesasGerais,
  criarDespesaGeral,
  excluirDespesaGeral,
} from "../data/despesasGerais";
import { formatarData } from "../utils/formatadores";

function DespesasExtras() {
  const [despesas, setDespesas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [novaDespesa, setNovaDespesa] = useState({
    data: "",
    descricao: "",
    valor: "",
  });

  async function carregar() {
    setCarregando(true);

    try {
      const dados = await getDespesasGerais();
      setDespesas(dados);
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

  async function adicionarDespesa() {
    if (!novaDespesa.data || !novaDespesa.descricao || !novaDespesa.valor) {
      alert("Preencha todos os campos.");
      return;
    }

    try {
      const despesa = await criarDespesaGeral(novaDespesa);
      setDespesas((atuais) => [despesa, ...atuais]);
      setNovaDespesa({ data: "", descricao: "", valor: "" });
    } catch (e) {
      alert("Não foi possível salvar a despesa: " + e.message);
    }
  }

  async function excluirDespesa(id) {
    const confirmar = window.confirm(
      "Tem certeza que deseja excluir esta despesa?"
    );

    if (!confirmar) return;

    try {
      await excluirDespesaGeral(id);
      setDespesas((atuais) => atuais.filter((despesa) => despesa.id !== id));
    } catch (e) {
      alert("Não foi possível excluir a despesa: " + e.message);
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

  const total = despesas.reduce(
    (soma, despesa) => soma + Number(despesa.valor || 0),
    0
  );

  return (
    <div>
      <div style={estiloContainer}>
        <h1>Despesas Extras</h1>

        <p style={estiloLegenda}>
          Despesas gerais da empresa, sem ligação com um caminhão
          específico.
        </p>

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
                setNovaDespesa({ ...novaDespesa, descricao: e.target.value })
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

        {despesas.length === 0 ? (
          <div style={estiloVazio}>
            <h3>Nenhuma despesa cadastrada</h3>
            <p>Use o formulário acima para lançar a primeira.</p>
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: "20px" }}>
              Total: R$ {total.toFixed(2).replace(".", ",")}
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
                  {despesas.map((despesa) => (
                    <tr key={despesa.id}>
                      <td style={estiloTd}>{formatarData(despesa.data)}</td>
                      <td style={estiloTd}>{despesa.descricao}</td>
                      <td style={estiloTd}>
                        R$ {Number(despesa.valor).toFixed(2).replace(".", ",")}
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
  margin: "5px 0 25px",
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
