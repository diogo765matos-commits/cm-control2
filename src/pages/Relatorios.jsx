import { useEffect, useState } from "react";
import {
  getSemanasDespesasGerais,
  criarSemanaDespesasGerais,
  adicionarDespesaGeral,
  excluirDespesaGeral,
  excluirSemanaDespesasGerais,
  atualizarSemanaDespesasGerais,
} from "../data/despesasGerais";
import { formatarData, formatarMoeda } from "../utils/formatadores";
import PageHeader from "../components/PageHeader";
import DateRangeFilter from "../components/DateRangeFilter";
import KpiCard, { CORES_KPI } from "../components/KpiCard";

function DespesasExtras() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [semanas, setSemanas] = useState([]);
  const [semanaAberta, setSemanaAberta] = useState(null);

  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");

  const [mostrarNovaSemana, setMostrarNovaSemana] = useState(false);
  const [inicioSemana, setInicioSemana] = useState("");
  const [fimSemana, setFimSemana] = useState("");

  const [editandoSemana, setEditandoSemana] = useState(null);

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

  function semanaNoFiltro(semana) {
    if (filtroInicio && semana.inicio < filtroInicio) return false;
    if (filtroFim && semana.inicio > filtroFim) return false;
    return true;
  }

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

  function abrirEdicaoSemana(semana) {
    setEditandoSemana({
      id: semana.id,
      inicio: semana.inicio,
      fim: semana.fim,
    });
  }

  async function salvarEdicaoSemana() {
    if (!editandoSemana.inicio || !editandoSemana.fim) {
      alert("Informe o início e o fim da semana.");
      return;
    }

    try {
      const atualizada = await atualizarSemanaDespesasGerais(
        editandoSemana.id,
        { inicio: editandoSemana.inicio, fim: editandoSemana.fim }
      );

      setSemanas((atuais) =>
        atuais.map((semana) =>
          semana.id === atualizada.id ? atualizada : semana
        )
      );

      setEditandoSemana(null);
    } catch (e) {
      alert("Não foi possível salvar a alteração: " + e.message);
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

  const semanasVisiveis = semanas.filter(semanaNoFiltro);
  const despesasVisiveis = semanasVisiveis.flatMap((semana) => semana.despesas);

  const totalDespesas = despesasVisiveis.reduce(
    (total, despesa) => total + Number(despesa.valor || 0),
    0
  );

  const maiorDespesa = despesasVisiveis.reduce(
    (maior, despesa) => Math.max(maior, Number(despesa.valor || 0)),
    0
  );

  const mediaDespesa =
    despesasVisiveis.length > 0 ? totalDespesas / despesasVisiveis.length : 0;

  return (
    <div>
      <PageHeader
        titulo="Despesas Extras"
        subtitulo="Despesas gerais da empresa, sem ligação com um caminhão específico."
      >
        <DateRangeFilter
          inicio={filtroInicio}
          fim={filtroFim}
          onAplicar={(inicio, fim) => {
            setFiltroInicio(inicio);
            setFiltroFim(fim);
          }}
          onLimpar={() => {
            setFiltroInicio("");
            setFiltroFim("");
          }}
        />
      </PageHeader>

      <div style={estiloGridKpis}>
        <KpiCard
          icone="👛"
          cor={CORES_KPI.verde}
          rotulo="Total de Despesas"
          valor={formatarMoeda(totalDespesas)}
          legenda="No período selecionado"
        />
        <KpiCard
          icone="📄"
          cor={CORES_KPI.azul}
          rotulo="Quantidade"
          valor={despesasVisiveis.length}
          legenda="Despesas registradas"
        />
        <KpiCard
          icone="⬆️"
          cor={CORES_KPI.laranja}
          rotulo="Maior Despesa"
          valor={formatarMoeda(maiorDespesa)}
          legenda="No período selecionado"
        />
        <KpiCard
          icone="🧮"
          cor={CORES_KPI.roxo}
          rotulo="Média por Despesa"
          valor={formatarMoeda(mediaDespesa)}
          legenda="Valor médio"
        />
      </div>

      <div style={estiloContainer}>
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

            {semanasVisiveis.length === 0 ? (
              <div style={estiloVazio}>
                <h3>
                  {semanas.length === 0
                    ? "Nenhuma semana cadastrada"
                    : "Nenhuma semana no período selecionado"}
                </h3>

                <p>
                  {semanas.length === 0
                    ? 'Clique em "+ Nova Semana" para começar a lançar despesas.'
                    : "Ajuste o filtro de período para ver outras semanas."}
                </p>
              </div>
            ) : (
              <div style={estiloListaSemanas}>
                {semanasVisiveis.map((semana) =>
                  editandoSemana?.id === semana.id ? (
                    <div key={semana.id} style={estiloSemana}>
                      <div style={estiloCampos}>
                        <Campo
                          titulo="Início"
                          type="date"
                          value={editandoSemana.inicio}
                          onChange={(e) =>
                            setEditandoSemana({
                              ...editandoSemana,
                              inicio: e.target.value,
                            })
                          }
                        />

                        <Campo
                          titulo="Fim"
                          type="date"
                          value={editandoSemana.fim}
                          onChange={(e) =>
                            setEditandoSemana({
                              ...editandoSemana,
                              fim: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          style={estiloBotaoCancelar}
                          onClick={() => setEditandoSemana(null)}
                        >
                          Cancelar
                        </button>

                        <button
                          style={estiloBotaoDourado}
                          onClick={salvarEdicaoSemana}
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={semana.id} style={estiloSemanaRica}>
                      <div style={estiloSemanaInfo}>
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

                      {(() => {
                        const totalSemana = semana.despesas.reduce(
                          (total, despesa) => total + Number(despesa.valor || 0),
                          0
                        );
                        const maiorSemana = semana.despesas.reduce(
                          (maior, despesa) =>
                            Math.max(maior, Number(despesa.valor || 0)),
                          0
                        );
                        const mediaSemana =
                          semana.despesas.length > 0
                            ? totalSemana / semana.despesas.length
                            : 0;

                        return (
                          <div style={estiloEstatisticasSemana}>
                            <MiniEstatistica
                              titulo="Total de Despesas"
                              valor={formatarMoeda(totalSemana)}
                              destaque
                            />
                            <MiniEstatistica
                              titulo="Maior Despesa"
                              valor={formatarMoeda(maiorSemana)}
                            />
                            <MiniEstatistica
                              titulo="Média por Despesa"
                              valor={formatarMoeda(mediaSemana)}
                            />
                          </div>
                        );
                      })()}

                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          style={estiloBotaoEditar}
                          onClick={() => abrirEdicaoSemana(semana)}
                        >
                          ✏️
                        </button>

                        <button
                          style={estiloBotaoEscuro}
                          onClick={() => setSemanaAberta(semana)}
                        >
                          Abrir →
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            <p style={estiloRodapeInfo}>
              ℹ️ Despesas extras são custos que não estão vinculados a um
              caminhão específico.
            </p>
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
                style={estiloBotaoExcluirSemana}
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
                  Total:{" "}
                  {formatarMoeda(
                    semanaAberta.despesas.reduce(
                      (total, despesa) => total + Number(despesa.valor || 0),
                      0
                    )
                  )}
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
                            {formatarMoeda(despesa.valor)}
                          </td>
                          <td style={estiloTd}>
                            <button
                              onClick={() => excluirDespesa(despesa.id)}
                              style={estiloBotaoExcluirLinha}
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

function MiniEstatistica({ titulo, valor, destaque }) {
  return (
    <div style={estiloMiniEstatistica}>
      <span style={estiloMiniEstatisticaTitulo}>{titulo}</span>
      <strong
        style={{
          ...estiloMiniEstatisticaValor,
          color: destaque ? "var(--cor-primaria)" : "var(--cor-texto)",
        }}
      >
        {valor}
      </strong>
    </div>
  );
}

const estiloGridKpis = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const estiloContainer = {
  background: "white",
  padding: "30px",
  borderRadius: "var(--raio)",
  boxShadow: "var(--sombra-card)",
};

const estiloLegenda = {
  color: "var(--cor-texto-secundario)",
  margin: "5px 0",
};

const estiloCabecalhoSecao = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "25px",
};

const estiloFormulario = {
  background: "#f9fafb",
  border: "1px solid var(--cor-borda)",
  padding: "20px",
  borderRadius: "var(--raio-pequeno)",
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
  border: "1px solid var(--cor-borda)",
  borderRadius: "var(--raio-pequeno)",
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
  background: "var(--cor-primaria)",
  color: "white",
  border: "none",
  padding: "12px 20px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
  fontWeight: "bold",
};

const estiloBotaoCancelar = {
  background: "#eee",
  color: "#333",
  border: "none",
  padding: "12px 20px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
};

const estiloBotaoEscuro = {
  background: "var(--cor-sidebar)",
  color: "white",
  border: "none",
  padding: "12px 20px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
};

const estiloBotaoEditar = {
  background: "white",
  color: "#111",
  border: "1px solid var(--cor-borda)",
  padding: "10px 18px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
  fontWeight: "bold",
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

const estiloBotaoExcluirSemana = {
  background: "var(--cor-perigo-clara)",
  color: "var(--cor-perigo)",
  border: "none",
  padding: "10px 16px",
  borderRadius: "var(--raio-pequeno)",
  cursor: "pointer",
  fontWeight: "bold",
};

const estiloBotaoExcluirLinha = {
  background: "var(--cor-perigo-clara)",
  color: "var(--cor-perigo)",
  border: "none",
  padding: "8px 12px",
  borderRadius: "var(--raio-pequeno)",
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

const estiloListaSemanas = {
  display: "grid",
  gap: "15px",
};

const estiloSemana = {
  border: "1px solid var(--cor-borda)",
  padding: "20px",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
};

const estiloSemanaRica = {
  border: "1px solid var(--cor-borda)",
  padding: "18px 20px",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  flexWrap: "wrap",
};

const estiloSemanaInfo = {
  minWidth: "160px",
};

const estiloEstatisticasSemana = {
  display: "flex",
  gap: "22px",
  flexWrap: "wrap",
  flex: 1,
};

const estiloMiniEstatistica = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  minWidth: "110px",
};

const estiloMiniEstatisticaTitulo = {
  fontSize: "11px",
  color: "var(--cor-texto-secundario)",
  whiteSpace: "nowrap",
};

const estiloMiniEstatisticaValor = {
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const estiloQuantidade = {
  marginTop: "8px",
  color: "var(--cor-primaria)",
  fontWeight: "bold",
};

const estiloTabelaContainer = {
  overflowX: "auto",
  border: "1px solid var(--cor-borda)",
  borderRadius: "10px",
};

const estiloTabela = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "600px",
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
  padding: "14px",
  borderBottom: "1px solid var(--cor-borda)",
  whiteSpace: "nowrap",
  fontSize: "14px",
};

const estiloRodapeInfo = {
  marginTop: "20px",
  padding: "14px 16px",
  background: "#f9fafb",
  borderRadius: "var(--raio-pequeno)",
  color: "var(--cor-texto-secundario)",
  fontSize: "13px",
};

export default DespesasExtras;
