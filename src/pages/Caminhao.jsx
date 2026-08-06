import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCaminhoes } from "../data/caminhoes";
import { VALOR_POR_VOLUME, PERCENTUAL_MOTORISTA } from "../data/config";
import {
  converterNumero,
  formatarData,
  formatarMoeda,
  formatarNumero,
} from "../utils/formatadores";

function Caminhao() {
  const { placa } = useParams();
  const navigate = useNavigate();

  const [abaAtiva, setAbaAtiva] = useState("viagens");
// ======================
// DESPESAS EXTRAS
// ======================

const [despesas, setDespesas] = useState(() => {
    const despesasSalvas = localStorage.getItem(`despesas-${placa}`);

    return despesasSalvas
        ? JSON.parse(despesasSalvas)
        : [];
});
useEffect(() => {
    localStorage.setItem(
        `despesas-${placa}`,
        JSON.stringify(despesas)
    );
}, [despesas, placa]);
const [novaDespesa, setNovaDespesa] = useState({
    data: "",
    descricao: "",
    valor: ""
});
// ========================
// SEMANAS DAS DESPESAS
// ========================

const [semanasDespesas, setSemanasDespesas] = useState(() => {
  const salvo = localStorage.getItem(`semanas-despesas-${placa}`);
  return salvo ? JSON.parse(salvo) : [];
});

const [semanaDespesaAberta, setSemanaDespesaAberta] = useState(null);

const [mostrarNovaSemanaDespesa, setMostrarNovaSemanaDespesa] =
  useState(false);

const [inicioSemanaDespesa, setInicioSemanaDespesa] = useState("");
const [fimSemanaDespesa, setFimSemanaDespesa] = useState("");

useEffect(() => {
  localStorage.setItem(
    `semanas-despesas-${placa}`,
    JSON.stringify(semanasDespesas)
  );
}, [semanasDespesas, placa]);
function criarSemanaDespesa() {
  if (!inicioSemanaDespesa || !fimSemanaDespesa) {
    alert("Informe o início e o fim da semana.");
    return;
  }

  const novaSemana = {
    id: Date.now(),
    inicio: inicioSemanaDespesa,
    fim: fimSemanaDespesa,
    despesas: [],
  };

  setSemanasDespesas((semanas) => [...semanas, novaSemana]);

  setInicioSemanaDespesa("");
  setFimSemanaDespesa("");
  setMostrarNovaSemanaDespesa(false);
}
function adicionarDespesa() {

    if (
        !novaDespesa.data ||
        !novaDespesa.descricao ||
        !novaDespesa.valor
    ) {
        alert("Preencha todos os campos da despesa.");
        return;
    }

    const despesa = {
        id: Date.now(),
        ...novaDespesa,
        valor: Number(novaDespesa.valor)
    };

    if (!semanaDespesaAberta) {
  alert("Abra uma semana antes de cadastrar uma despesa.");
  return;
}

const semanasAtualizadas = semanasDespesas.map((semana) => {
  if (semana.id === semanaDespesaAberta.id) {
    return {
      ...semana,
      despesas: [...semana.despesas, despesa],
    };
  }

  return semana;
});

setSemanasDespesas(semanasAtualizadas);

const semanaAtualizada = semanasAtualizadas.find(
  (semana) => semana.id === semanaDespesaAberta.id
);

setSemanaDespesaAberta(semanaAtualizada);

    setNovaDespesa({
        data: "",
        descricao: "",
        valor: ""
    });
}
function excluirDespesaSemana(idDespesa) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir esta despesa?"
  );

  if (!confirmar) {
    return;
  }

  const semanasAtualizadas = semanasDespesas.map((semana) => {
    if (semana.id === semanaDespesaAberta.id) {
      return {
        ...semana,
        despesas: semana.despesas.filter(
          (despesa) => despesa.id !== idDespesa
        ),
      };
    }

    return semana;
  });

  setSemanasDespesas(semanasAtualizadas);

  const semanaAtualizada = semanasAtualizadas.find(
    (semana) => semana.id === semanaDespesaAberta.id
  );

  setSemanaDespesaAberta(semanaAtualizada);
}
function excluirSemanaDespesa(idSemana) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir esta semana e todas as despesas cadastradas nela?"
  );

  if (!confirmar) {
    return;
  }

  const semanasAtualizadas = semanasDespesas.filter(
    (semana) => semana.id !== idSemana
  );

  setSemanasDespesas(semanasAtualizadas);

  if (semanaDespesaAberta?.id === idSemana) {
    setSemanaDespesaAberta(null);
  }
}
  // =========================
  // VIAGENS
  // =========================

  const [semanas, setSemanas] = useState(() => {
    const dadosSalvos = localStorage.getItem(
        `viagens-semanas-${placa}`
    );

    return dadosSalvos
        ? JSON.parse(dadosSalvos)
        : [];
});
useEffect(() => {
    localStorage.setItem(
        `viagens-semanas-${placa}`,
        JSON.stringify(semanas)
    );
}, [semanas, placa]);
  const [mostrarNovaSemana, setMostrarNovaSemana] = useState(false);

  const [inicioSemana, setInicioSemana] = useState("");
  const [fimSemana, setFimSemana] = useState("");

  const [semanaAberta, setSemanaAberta] = useState(null);
  const [mostrarNovaViagem, setMostrarNovaViagem] = useState(false);

  const [novaViagem, setNovaViagem] = useState({
    data: "",
    nf: "",
    cte: "",
    volFiscal: "",
    volEntregue: "",
    dataEntrega: "",
  });

  // =========================
  // ABASTECIMENTOS
  // =========================

  const [mostrarNovoAbastecimento, setMostrarNovoAbastecimento] =
    useState(false);
    // ========================
// SEMANAS DE ABASTECIMENTO
// ========================

const [semanasAbastecimento, setSemanasAbastecimento] = useState(() => {
    const dadosSalvos = localStorage.getItem(
        `abastecimentos-semanas-${placa}`
    );

    return dadosSalvos
        ? JSON.parse(dadosSalvos)
        : [];
});
useEffect(() => {
    localStorage.setItem(
        `abastecimentos-semanas-${placa}`,
        JSON.stringify(semanasAbastecimento)
    );
}, [semanasAbastecimento, placa]);

const [semanaAbastecimentoAberta, setSemanaAbastecimentoAberta] = useState(null);

const [mostrarNovaSemanaAbastecimento, setMostrarNovaSemanaAbastecimento] = useState(false);

const [inicioSemanaAbastecimento, setInicioSemanaAbastecimento] = useState("");

const [fimSemanaAbastecimento, setFimSemanaAbastecimento] = useState("");
const [pesquisaInicioAbastecimento, setPesquisaInicioAbastecimento] = useState("");

const [pesquisaFimAbastecimento, setPesquisaFimAbastecimento] = useState("");

  const [novoAbastecimento, setNovoAbastecimento] = useState({
    data: "",
    posto: "",
    km: "",
    litrosDiesel: "",
    precoDiesel: "",
    litrosArla: "",
    precoArla: "",
  });

  // =========================
  // CAMINHÕES
  // =========================

  const caminhoes = getCaminhoes();

  const caminhao = caminhoes.find((item) => item.placa === placa);

  if (!caminhao) {
    return (
      <div>
        <h1>Caminhão não encontrado</h1>

        <button onClick={() => navigate("/frota")}>
          Voltar para Frota
        </button>
      </div>
    );
  }

  // =========================
  // FUNÇÕES DAS VIAGENS
  // =========================

  function criarSemana() {
    if (!inicioSemana || !fimSemana) {
      alert("Informe o início e o fim da semana.");
      return;
    }

    const novaSemana = {
      id: Date.now(),
      inicio: inicioSemana,
      fim: fimSemana,
      viagens: [],
    };

    setSemanas([...semanas, novaSemana]);

    setInicioSemana("");
    setFimSemana("");
    setMostrarNovaSemana(false);
  }

  function adicionarViagem() {
    if (!semanaAberta) return;

    if (!novaViagem.data || !novaViagem.nf) {
      alert("Informe pelo menos a data e a nota fiscal.");
      return;
    }

    const viagem = {
      id: Date.now(),
      ...novaViagem,
    };

    const semanasAtualizadas = semanas.map((semana) => {
      if (semana.id === semanaAberta.id) {
        return {
          ...semana,
          viagens: [...semana.viagens, viagem],
        };
      }

      return semana;
    });

    setSemanas(semanasAtualizadas);

    const semanaAtualizada = semanasAtualizadas.find(
      (semana) => semana.id === semanaAberta.id
    );

    setSemanaAberta(semanaAtualizada);

    setNovaViagem({
      data: "",
      nf: "",
      cte: "",
      volFiscal: "",
      volEntregue: "",
      dataEntrega: "",
    });

    setMostrarNovaViagem(false);
  }

  function excluirViagem(idViagem) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir esta viagem?"
  );

  if (!confirmar) {
    return;
  }

  const semanasAtualizadas = semanas.map((semana) => {
    if (semana.id === semanaAberta.id) {
      return {
        ...semana,
        viagens: semana.viagens.filter(
          (viagem) => viagem.id !== idViagem
        ),
      };
    }

    return semana;
  });

  setSemanas(semanasAtualizadas);

  const semanaAtualizada = semanasAtualizadas.find(
    (semana) => semana.id === semanaAberta.id
  );

  setSemanaAberta(semanaAtualizada);
}

function excluirSemanaViagens(idSemana) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir esta semana e todas as viagens cadastradas nela?"
  );

  if (!confirmar) {
    return;
  }

  setSemanas((semanasAtuais) =>
    semanasAtuais.filter((semana) => semana.id !== idSemana)
  );

  setSemanaAberta(null);
  setMostrarNovaViagem(false);
}

  function calcularDiferenca(volFiscal, volEntregue) {
    const fiscal = converterNumero(volFiscal);
    const entregue = converterNumero(volEntregue);

    if (isNaN(fiscal) || isNaN(entregue)) {
      return "-";
    }

    return (entregue - fiscal).toFixed(2);
  }

  // =========================
  // FUNÇÕES DOS ABASTECIMENTOS
  // =========================

  function adicionarAbastecimento() {
    if (
      !novoAbastecimento.data ||
      !novoAbastecimento.posto ||
      !novoAbastecimento.km ||
      !novoAbastecimento.litrosDiesel ||
      !novoAbastecimento.precoDiesel
    ) {
      alert(
        "Preencha data, posto, KM, litros de diesel e preço do diesel."
      );
      return;
    }

    const kmAtual = converterNumero(novoAbastecimento.km);
    const litrosDiesel = converterNumero(
      novoAbastecimento.litrosDiesel
    );

    const precoDiesel = converterNumero(
      novoAbastecimento.precoDiesel
    );

    const litrosArla =
      converterNumero(novoAbastecimento.litrosArla) || 0;

    const precoArla =
      converterNumero(novoAbastecimento.precoArla) || 0;

    const valorDiesel = litrosDiesel * precoDiesel;
    const valorArla = litrosArla * precoArla;
    const valorTotal = valorDiesel + valorArla;

    let media = null;
    const semanaAtual = semanasAbastecimento.find(
  (semana) => semana.id === semanaAbastecimentoAberta
);

const abastecimentosDaSemana =
  semanaAtual?.abastecimentos || [];

    if (abastecimentosDaSemana.length > 0) {
  const ultimoAbastecimento =
    abastecimentosDaSemana[abastecimentosDaSemana.length - 1];

      const kmAnterior = converterNumero(
        ultimoAbastecimento.km
      );

      const distancia = kmAtual - kmAnterior;

      if (distancia > 0 && litrosDiesel > 0) {
        media = distancia / litrosDiesel;
      }
    }

    const abastecimento = {
      id: Date.now(),

      data: novoAbastecimento.data,
      posto: novoAbastecimento.posto,

      km: kmAtual,

      litrosDiesel,
      precoDiesel,

      litrosArla,
      precoArla,

      media,

      valorDiesel,
      valorArla,
      valorTotal,
    };

    setSemanasAbastecimento((semanas) =>
  semanas.map((semana) =>
    semana.id === semanaAbastecimentoAberta
      ? {
          ...semana,
          abastecimentos: [
            ...semana.abastecimentos,
            abastecimento,
          ],
        }
      : semana
  )
);

    setNovoAbastecimento({
      data: "",
      posto: "",
      km: "",
      litrosDiesel: "",
      precoDiesel: "",
      litrosArla: "",
      precoArla: "",
    });

    setMostrarNovoAbastecimento(false);
  }
function excluirAbastecimento(idAbastecimento) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir este abastecimento?"
  );

  if (!confirmar) {
    return;
  }

  setSemanasAbastecimento((semanas) =>
    semanas.map((semana) =>
      semana.id === semanaAbastecimentoAberta
        ? {
            ...semana,
            abastecimentos: semana.abastecimentos.filter(
              (abastecimento) => abastecimento.id !== idAbastecimento
            ),
          }
        : semana
    )
  );
}

function excluirSemanaAbastecimento(idSemana) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir esta semana e todos os abastecimentos dela?"
  );

  if (!confirmar) {
    return;
  }

  setSemanasAbastecimento((semanas) =>
    semanas.filter((semana) => semana.id !== idSemana)
  );

  setSemanaAbastecimentoAberta(null);
  setMostrarNovoAbastecimento(false);
}
  // =========================
  // TELA
  // =========================

  return (
    <div>
      <button
        onClick={() => navigate("/frota")}
        style={estiloVoltar}
      >
        ← Voltar para Frota
      </button>

      <div style={estiloContainer}>
        <h1>🚛 {caminhao.modelo}</h1>

        <div style={estiloInformacoes}>
          <div>
            <p style={estiloLegenda}>Placa</p>
            <strong>{caminhao.placa}</strong>
          </div>

          <div>
            <p style={estiloLegenda}>Motorista</p>
            <strong>{caminhao.motorista}</strong>
          </div>
        </div>

        <div style={estiloMenuAbas}>
          

          <button
            onClick={() => setAbaAtiva("viagens")}
            style={estiloAba(abaAtiva === "viagens")}
          >
            🚚 Viagens
          </button>

          <button
            onClick={() =>
              setAbaAtiva("abastecimentos")
            }
            style={estiloAba(
              abaAtiva === "abastecimentos"
            )}
          >
            ⛽ Abastecimentos
          </button>

          <button
  onClick={() => setAbaAtiva("despesas")}
  style={estiloAba(abaAtiva === "despesas")}
>
  🧾 Despesas Extras
</button>

<button
  onClick={() => setAbaAtiva("financeiro")}
  style={estiloAba(abaAtiva === "financeiro")}
>
  💰 Financeiro
</button>
        </div>

        {/* VIAGENS */}

        {abaAtiva === "viagens" && (
             <div>
                <div style={{ marginBottom: "20px" }}>
  <CardResumo
    titulo="Quantidade de Viagens"
    valor={semanas.reduce(
      (total, semana) => total + semana.viagens.length,
      0
    )}
  />
</div>
            {!semanaAberta ? (
              <>
                <div style={estiloCabecalhoSecao}>
                  <div>
                    <h2>Semanas</h2>

                    <p style={estiloLegenda}>
                      Organize as viagens por período
                      semanal.
                    </p>
                  </div>

                  <button
                    style={estiloBotaoDourado}
                    onClick={() =>
                      setMostrarNovaSemana(true)
                    }
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
                        onChange={(e) =>
                          setInicioSemana(e.target.value)
                        }
                      />

                      <Campo
                        titulo="Fim"
                        type="date"
                        value={fimSemana}
                        onChange={(e) =>
                          setFimSemana(e.target.value)
                        }
                      />
                    </div>

                    <div style={estiloAcoesFormulario}>
                      <button
                        style={estiloBotaoCancelar}
                        onClick={() =>
                          setMostrarNovaSemana(false)
                        }
                      >
                        Cancelar
                      </button>

                      <button
                        style={estiloBotaoDourado}
                        onClick={criarSemana}
                      >
                        Salvar Semana
                      </button>
                    </div>
                  </div>
                )}

                {semanas.length === 0 ? (
                  <div style={estiloVazio}>
                    <h3>
                      Nenhuma semana cadastrada
                    </h3>

                    <p>
                      Clique em "+ Nova Semana" para
                      começar a lançar as viagens.
                    </p>
                  </div>
                ) : (
                  <div style={estiloListaSemanas}>
                    {semanas.map((semana) => (
                      <div
                        key={semana.id}
                        style={estiloSemana}
                      >
                        <div>
                          <p style={estiloLegenda}>
                            Período
                          </p>

                          <h3>
                            {formatarData(
                              semana.inicio
                            )}{" "}
                            até{" "}
                            {formatarData(semana.fim)}
                          </h3>

                          <p style={estiloQuantidade}>
                            {semana.viagens.length}{" "}
                            {semana.viagens.length === 1
                              ? "viagem"
                              : "viagens"}
                          </p>
                        </div>

                        <button
                          style={estiloBotaoEscuro}
                          onClick={() =>
                            setSemanaAberta(semana)
                          }
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
                      onClick={() => {
                        setSemanaAberta(null);
                        setMostrarNovaViagem(false);
                      }}
                    >
                      ← Voltar para semanas
                    </button>

                    <h2>
                      {formatarData(
                        semanaAberta.inicio
                      )}{" "}
                      até{" "}
                      {formatarData(semanaAberta.fim)}
                    </h2>

                    <p style={estiloLegenda}>
                      {semanaAberta.viagens.length}{" "}
                      {semanaAberta.viagens.length === 1
                        ? "viagem cadastrada"
                        : "viagens cadastradas"}
                    </p>
                  </div>

                  <button
                    style={estiloBotaoDourado}
                    onClick={() =>
                      setMostrarNovaViagem(true)
                    }
                  >
                    + Nova Viagem
                  </button>
                  <button
  onClick={() => excluirSemanaViagens(semanaAberta.id)}
  style={{
    background: "#dc3545",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "6px",
    cursor: "pointer",
    marginLeft: "10px",
  }}
>
  Excluir Semana
</button>
                </div>

                {mostrarNovaViagem && (
                  <div style={estiloFormulario}>
                    <h3>Nova Viagem</h3>

                    <div style={estiloGridFormulario}>
                      <Campo
                        titulo="Data"
                        type="date"
                        value={novaViagem.data}
                        onChange={(e) =>
                          setNovaViagem({
                            ...novaViagem,
                            data: e.target.value,
                          })
                        }
                      />

                      <Campo
                        titulo="Nº Nota Fiscal"
                        placeholder="Ex: 45871"
                        value={novaViagem.nf}
                        onChange={(e) =>
                          setNovaViagem({
                            ...novaViagem,
                            nf: e.target.value,
                          })
                        }
                      />

                      <Campo
                        titulo="CTe"
                        placeholder="Ex: 98471"
                        value={novaViagem.cte}
                        onChange={(e) =>
                          setNovaViagem({
                            ...novaViagem,
                            cte: e.target.value,
                          })
                        }
                      />

                      <Campo
                        titulo="Vol. Fiscal"
                        type="number"
                        step="0.01"
                        value={novaViagem.volFiscal}
                        onChange={(e) =>
                          setNovaViagem({
                            ...novaViagem,
                            volFiscal: e.target.value,
                          })
                        }
                      />

                      <Campo
                        titulo="Vol. Entregue"
                        type="number"
                        step="0.01"
                        value={novaViagem.volEntregue}
                        onChange={(e) =>
                          setNovaViagem({
                            ...novaViagem,
                            volEntregue:
                              e.target.value,
                          })
                        }
                      />

                      <Campo
                        titulo="Data da Entrega"
                        type="date"
                        value={novaViagem.dataEntrega}
                        onChange={(e) =>
                          setNovaViagem({
                            ...novaViagem,
                            dataEntrega:
                              e.target.value,
                          })
                        }
                      />
                    </div>

                    <div style={estiloPreviaDiferenca}>
                      Diferença:{" "}
                      <strong>
                        {calcularDiferenca(
                          novaViagem.volFiscal,
                          novaViagem.volEntregue
                        )}
                      </strong>
                    </div>

                    <div style={estiloAcoesFormulario}>
                      <button
                        style={estiloBotaoCancelar}
                        onClick={() =>
                          setMostrarNovaViagem(false)
                        }
                      >
                        Cancelar
                      </button>

                      <button
                        style={estiloBotaoDourado}
                        onClick={adicionarViagem}
                      >
                        Salvar Viagem
                      </button>
                    </div>
                  </div>
                )}

                {semanaAberta.viagens.length === 0 ? (
                  <div style={estiloVazio}>
                    <h3>
                      Nenhuma viagem nesta semana
                    </h3>

                    <p>
                      Clique em "+ Nova Viagem" para
                      fazer o primeiro lançamento.
                    </p>
                  </div>
                ) : (
                  <div style={estiloTabelaContainer}>
                    <table style={estiloTabela}>
                      <thead>
                        <tr>
                          <th style={estiloTh}>Data</th>
                          <th style={estiloTh}>NF</th>
                          <th style={estiloTh}>CTe</th>
                          <th style={estiloTh}>
                            Vol. Fiscal
                          </th>
                          <th style={estiloTh}>
                            Vol. Entregue
                          </th>
                          <th style={estiloTh}>
                            Diferença
                          </th>
                          <th style={estiloTh}>
                            Entrega
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {semanaAberta.viagens.map(
                          (viagem) => (
                            <tr key={viagem.id}>
                              <td style={estiloTd}>
                                {formatarData(
                                  viagem.data
                                )}
                              </td>

                              <td style={estiloTd}>
                                {viagem.nf || "-"}
                              </td>

                              <td style={estiloTd}>
                                {viagem.cte || "-"}
                              </td>

                              <td style={estiloTd}>
                                {viagem.volFiscal ||
                                  "-"}
                              </td>

                              <td style={estiloTd}>
                                {viagem.volEntregue ||
                                  "-"}
                              </td>

                              <td style={estiloTd}>
                                {calcularDiferenca(
                                  viagem.volFiscal,
                                  viagem.volEntregue
                                )}
                              </td>

                              <td style={estiloTd}>
                                {formatarData(
                                  viagem.dataEntrega
                                )}
                              </td>
                            
                            <td style={estiloTd}>
  <button
    onClick={() => excluirViagem(viagem.id)}
    style={{
      background: "#dc3545",
      color: "white",
      border: "none",
      padding: "6px 10px",
      borderRadius: "6px",
      cursor: "pointer",
    }}
  >
    Excluir
  </button>
</td>
</tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ABASTECIMENTOS */}

        {abaAtiva === "abastecimentos" && (
          <div>
            <div style={estiloCabecalhoSecao}>
              <div>
                <h2>Abastecimentos</h2>

                <p style={estiloLegenda}>
                  Controle de diesel, ARLA e consumo
                  deste caminhão.
                </p>
              </div>

              <button
    style={estiloBotaoDourado}
    onClick={() =>
        setMostrarNovaSemanaAbastecimento(true)
    }
>
    + Nova Semana
</button>
{mostrarNovaSemanaAbastecimento && (
    <div style={estiloFormulario}>

        <h3>Nova Semana de Abastecimento</h3>

        <div style={estiloCampos}>

            <Campo
                titulo="Início"
                type="date"
                value={inicioSemanaAbastecimento}
                onChange={(e) =>
                    setInicioSemanaAbastecimento(e.target.value)
                }
            />

            <Campo
                titulo="Fim"
                type="date"
                value={fimSemanaAbastecimento}
                onChange={(e) =>
                    setFimSemanaAbastecimento(e.target.value)
                }
            />

        </div>
<button
    style={{
        ...estiloBotaoDourado,
        marginTop: "20px"
    }}
    onClick={() => {

        if (!inicioSemanaAbastecimento || !fimSemanaAbastecimento) {
            alert("Selecione o início e o fim da semana.");
            return;
        }

        const novaSemana = {
            id: Date.now(),
            inicio: inicioSemanaAbastecimento,
            fim: fimSemanaAbastecimento,
            abastecimentos: []
        };

        setSemanasAbastecimento([
            ...semanasAbastecimento,
            novaSemana
        ]);

        setInicioSemanaAbastecimento("");
        setFimSemanaAbastecimento("");
        setMostrarNovaSemanaAbastecimento(false);
    }}
>
    Criar Semana
</button>
    </div>
)}
<div
    style={{
        marginTop: "30px",
        display: semanaAbastecimentoAberta ? "none" : "block"
    }}
>
  


    <h3>Semanas de Abastecimento</h3>
    <div
  style={{
    display: "flex",
    gap: "15px",
    marginTop: "20px",
    marginBottom: "25px",
    flexWrap: "wrap",
  }}
>
  <Campo
    titulo="Pesquisar de"
    type="date"
    value={pesquisaInicioAbastecimento}
    onChange={(e) =>
      setPesquisaInicioAbastecimento(e.target.value)
    }
  />

  <Campo
    titulo="Até"
    type="date"
    value={pesquisaFimAbastecimento}
    onChange={(e) =>
      setPesquisaFimAbastecimento(e.target.value)
    }
  />
</div>
 

    {semanasAbastecimento.length === 0 ? (
        <p style={estiloLegenda}>
            Nenhuma semana cadastrada.
        </p>
    ) : (
        semanasAbastecimento
  .filter((semana) => {
    if (
      pesquisaInicioAbastecimento &&
      semana.inicio < pesquisaInicioAbastecimento
    ) {
      return false;
    }

    if (
      pesquisaFimAbastecimento &&
      semana.fim > pesquisaFimAbastecimento
    ) {
      return false;
    }

    return true;
  })
  .map((semana) => (

            <div
                key={semana.id}
                style={{
                    padding: "18px",
                    border: "1px solid #ddd",
                    borderRadius: "10px",
                    marginTop: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}
            >

                <div>
                    <strong>
                        Período: {semana.inicio} até {semana.fim}
                    </strong>

                    <p style={{ margin: "6px 0 0" }}>
                        {semana.abastecimentos.length} abastecimento(s)
                    </p>
                </div>

                <button
                    style={estiloBotaoDourado}
                    onClick={() => {
    setSemanaAbastecimentoAberta(semana.id);
    
}}
                >
                    Abrir →
                </button>

            </div>

        ))
    )}

</div>
{semanaAbastecimentoAberta && (() => {

    const semana = semanasAbastecimento.find(
        (item) => item.id === semanaAbastecimentoAberta
    );

    if (!semana) return null;

    return (
        <div style={{ marginTop: "30px" }}>

            <button
                style={estiloBotaoDourado}
                onClick={() => {
                    setSemanaAbastecimentoAberta(null);
                    setMostrarNovoAbastecimento(false);
                }}
            >
                ← Voltar para Semanas
            </button>

            <button
  style={{
    ...estiloBotaoDourado,
    marginTop: "10px",
    backgroundColor: "#dc3545",
    color: "white",
  }}
  onClick={() => excluirSemanaAbastecimento(semana.id)}
>
  Excluir Semana
</button>

            <h2 style={{ marginTop: "25px" }}>
                Abastecimentos da Semana
            </h2>

            <p style={estiloLegenda}>
                Período: {semana.inicio} até {semana.fim}
            </p>

            <button
                style={{
                    ...estiloBotaoDourado,
                    marginTop: "20px"
                }}
                onClick={() =>
                    setMostrarNovoAbastecimento(true)
                }
            >
                + Novo Abastecimento
            </button>
{semana.abastecimentos.length === 0 ? (
  <p
    style={{
      ...estiloLegenda,
      marginTop: "25px",
    }}
  >
    Nenhum abastecimento cadastrado nesta semana.
  </p>
) : (
  <div
    style={{
      ...estiloTabelaContainer,
      marginTop: "25px",
    }}
  >
    <table
      style={{
        ...estiloTabela,
        minWidth: "1250px",
      }}
    >
      <thead>
        <tr>
          <th style={estiloTh}>Data</th>
          <th style={estiloTh}>Posto</th>
          <th style={estiloTh}>KM</th>
          <th style={estiloTh}>Diesel</th>
          <th style={estiloTh}>Média</th>
          <th style={estiloTh}>Preço/L Diesel</th>
          <th style={estiloTh}>ARLA</th>
          <th style={estiloTh}>Preço/L ARLA</th>
          <th style={estiloTh}>Valor Diesel</th>
          <th style={estiloTh}>Valor ARLA</th>
          <th style={estiloTh}>Valor Total</th>
          <th style={estiloTh}>Ações</th>
        </tr>
      </thead>

      <tbody>
  {semana.abastecimentos.map((abastecimento) => (
    <tr key={abastecimento.id}>
      <td style={estiloTd}>
        {formatarData(abastecimento.data)}
      </td>

      <td style={estiloTd}>
        {abastecimento.posto}
      </td>

      <td style={estiloTd}>
        {formatarNumero(abastecimento.km)}
      </td>

      <td style={estiloTd}>
        {formatarNumero(abastecimento.litrosDiesel)} L
      </td>

      <td style={estiloTd}>
        {abastecimento.media === null
          ? "—"
          : `${formatarNumero(abastecimento.media)} km/L`}
      </td>

      <td style={estiloTd}>
        {formatarMoeda(abastecimento.precoDiesel)}
      </td>

      <td style={estiloTd}>
        {formatarNumero(abastecimento.litrosArla)} L
      </td>

      <td style={estiloTd}>
        {formatarMoeda(abastecimento.precoArla)}
      </td>

      <td style={estiloTd}>
        {formatarMoeda(abastecimento.valorDiesel)}
      </td>

      <td style={estiloTd}>
        {formatarMoeda(abastecimento.valorArla)}
      </td>

      <td
        style={{
          ...estiloTd,
          fontWeight: "bold",
        }}
      >
        {formatarMoeda(abastecimento.valorTotal)}
      </td>
      <td style={estiloTd}>
  <button
    onClick={() => excluirAbastecimento(abastecimento.id)}
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
    Excluir
  </button>
</td>
    </tr>
  ))}
</tbody>
    </table>
    <div
  style={{
    ...estiloResumoFinanceiro,
    marginTop: "20px",
  }}
>
  <div>
    <span style={estiloLegenda}>Diesel abastecido</span>
    <strong>
      {formatarNumero(
        semana.abastecimentos.reduce(
          (total, abastecimento) =>
            total + abastecimento.litrosDiesel,
          0
        )
      )} L
    </strong>
  </div>

  <div>
    <span style={estiloLegenda}>ARLA abastecido</span>
    <strong>
      {formatarNumero(
        semana.abastecimentos.reduce(
          (total, abastecimento) =>
            total + abastecimento.litrosArla,
          0
        )
      )} L
    </strong>
  </div>

  <div>
    <span style={estiloLegenda}>Total Diesel</span>
    <strong>
      {formatarMoeda(
        semana.abastecimentos.reduce(
          (total, abastecimento) =>
            total + abastecimento.valorDiesel,
          0
        )
      )}
    </strong>
  </div>

  <div>
    <span style={estiloLegenda}>Total ARLA</span>
    <strong>
      {formatarMoeda(
        semana.abastecimentos.reduce(
          (total, abastecimento) =>
            total + abastecimento.valorArla,
          0
        )
      )}
    </strong>
  </div>

  <div>
    <span style={estiloLegenda}>Total Geral</span>
    <strong style={estiloValorTotal}>
      {formatarMoeda(
        semana.abastecimentos.reduce(
          (total, abastecimento) =>
            total + abastecimento.valorTotal,
          0
        )
      )}
    </strong>
  </div>
</div>
  </div>
)}
        </div>
    );

})()}
            </div>

            
            {semanaAbastecimentoAberta && mostrarNovoAbastecimento && (
              <div
                style={{
                  ...estiloFormulario,
                  marginTop: "25px",
                }}
              >
                <h3>Novo Abastecimento</h3>

                <div style={estiloGridFormulario}>
                  <Campo
                    titulo="Data"
                    type="date"
                    value={novoAbastecimento.data}
                    onChange={(e) =>
                      setNovoAbastecimento({
                        ...novoAbastecimento,
                        data: e.target.value,
                      })
                    }
                  />

                  <Campo
                    titulo="Posto"
                    placeholder="Nome do posto"
                    value={novoAbastecimento.posto}
                    onChange={(e) =>
                      setNovoAbastecimento({
                        ...novoAbastecimento,
                        posto: e.target.value,
                      })
                    }
                  />

                  <Campo
                    titulo="KM"
                    type="number"
                    placeholder="Quilometragem"
                    value={novoAbastecimento.km}
                    onChange={(e) =>
                      setNovoAbastecimento({
                        ...novoAbastecimento,
                        km: e.target.value,
                      })
                    }
                  />

                  <Campo
                    titulo="Qtd. Diesel (L)"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={
                      novoAbastecimento.litrosDiesel
                    }
                    onChange={(e) =>
                      setNovoAbastecimento({
                        ...novoAbastecimento,
                        litrosDiesel:
                          e.target.value,
                      })
                    }
                  />

                  <Campo
                    titulo="Preço/L Diesel"
                    type="number"
                    step="0.001"
                    placeholder="R$ 0,000"
                    value={
                      novoAbastecimento.precoDiesel
                    }
                    onChange={(e) =>
                      setNovoAbastecimento({
                        ...novoAbastecimento,
                        precoDiesel:
                          e.target.value,
                      })
                    }
                  />

                  <Campo
                    titulo="Qtd. ARLA (L)"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={
                      novoAbastecimento.litrosArla
                    }
                    onChange={(e) =>
                      setNovoAbastecimento({
                        ...novoAbastecimento,
                        litrosArla:
                          e.target.value,
                      })
                    }
                  />

                  <Campo
                    titulo="Preço/L ARLA"
                    type="number"
                    step="0.01"
                    placeholder="R$ 0,00"
                    value={
                      novoAbastecimento.precoArla
                    }
                    onChange={(e) =>
                      setNovoAbastecimento({
                        ...novoAbastecimento,
                        precoArla:
                          e.target.value,
                      })
                    }
                  />
                </div>

                <div style={estiloPreviaValores}>
                  <div>
                    <span style={estiloLegenda}>
                      Diesel
                    </span>

                    <strong>
                      {formatarMoeda(
                        (converterNumero(
                          novoAbastecimento.litrosDiesel
                        ) || 0) *
                          (converterNumero(
                            novoAbastecimento.precoDiesel
                          ) || 0)
                      )}
                    </strong>
                  </div>

                  <div>
                    <span style={estiloLegenda}>
                      ARLA
                    </span>

                    <strong>
                      {formatarMoeda(
                        (converterNumero(
                          novoAbastecimento.litrosArla
                        ) || 0) *
                          (converterNumero(
                            novoAbastecimento.precoArla
                          ) || 0)
                      )}
                    </strong>
                  </div>

                  <div>
                    <span style={estiloLegenda}>
                      Valor Total
                    </span>

                    <strong style={estiloValorTotal}>
                      {formatarMoeda(
                        (converterNumero(
                          novoAbastecimento.litrosDiesel
                        ) || 0) *
                          (converterNumero(
                            novoAbastecimento.precoDiesel
                          ) || 0) +
                          (converterNumero(
                            novoAbastecimento.litrosArla
                          ) || 0) *
                            (converterNumero(
                              novoAbastecimento.precoArla
                            ) || 0)
                      )}
                    </strong>
                  </div>
                </div>

                <div style={estiloAcoesFormulario}>
                  <button
                    style={estiloBotaoCancelar}
                    onClick={() =>
                      setMostrarNovoAbastecimento(
                        false
                      )
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    style={estiloBotaoDourado}
                    onClick={adicionarAbastecimento}
                  >
                    Salvar Abastecimento
                  </button>
                </div>
              </div>
            )}

            
          </div>
        )}
{/* DESPESAS EXTRAS */}

{abaAtiva === "despesas" && (
  <div>

    <div style={estiloCabecalhoSecao}>
      <div>
        <h2>Despesas Extras</h2>

        <p style={estiloLegenda}>
          Registre despesas extras deste caminhão.
        </p>
      </div>
    </div>

    <div style={{ marginTop: "20px", marginBottom: "25px" }}>
  <h2>Semanas</h2>

  <p style={estiloLegenda}>
    Organize as despesas por período semanal.
  </p>

  <button
    style={estiloBotaoDourado}
    onClick={() => setMostrarNovaSemanaDespesa(true)}
  >
    + Nova Semana
  </button>
</div>

{mostrarNovaSemanaDespesa && (
  <div style={estiloFormulario}>
    <h3>Nova Semana</h3>

    <div style={estiloCampos}>
      <Campo
        titulo="Início"
        type="date"
        value={inicioSemanaDespesa}
        onChange={(e) => setInicioSemanaDespesa(e.target.value)}
      />

      <Campo
        titulo="Fim"
        type="date"
        value={fimSemanaDespesa}
        onChange={(e) => setFimSemanaDespesa(e.target.value)}
      />
    </div>

    <button
      style={estiloBotaoDourado}
      onClick={criarSemanaDespesa}
    >
      Criar Semana
    </button>
  </div>
)}
{semanasDespesas.length === 0 ? (
  <p style={estiloLegenda}>
    Nenhuma semana cadastrada.
  </p>
) : (
  <div style={{ marginTop: "20px", marginBottom: "25px" }}>
    {semanasDespesas.map((semana) => (
      <div
        key={semana.id}
        style={{
          ...estiloFormulario,
          marginBottom: "15px",
        }}
      >
        <h3>
          {formatarData(semana.inicio)} até {formatarData(semana.fim)}
        </h3>

        <p style={estiloLegenda}>
          {semana.despesas.length}{" "}
          {semana.despesas.length === 1
            ? "despesa cadastrada"
            : "despesas cadastradas"}
        </p>

        <button
          style={estiloBotaoDourado}
          onClick={() => setSemanaDespesaAberta(semana)}
        >
          Abrir Semana
        </button>
      </div>
    ))}
  </div>
)}
{semanaDespesaAberta && (
  <>
  <div style={estiloCabecalhoSecao}>
  <div>
    <button
      style={estiloBotaoVoltarSemana}
      onClick={() => setSemanaDespesaAberta(null)}
    >
      ← Voltar para Semanas
    </button>
<button
  onClick={() => excluirSemanaDespesa(semanaDespesaAberta.id)}
  style={{
    background: "#dc3545",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    marginLeft: "10px",
  }}
>
  🗑 Excluir Semana
</button>
    <h2>
      {formatarData(semanaDespesaAberta.inicio)} até{" "}
      {formatarData(semanaDespesaAberta.fim)}
    </h2>

    <p style={estiloLegenda}>
      {semanaDespesaAberta.despesas.length}{" "}
      {semanaDespesaAberta.despesas.length === 1
        ? "despesa cadastrada"
        : "despesas cadastradas"}
    </p>
  </div>
</div>
    <div style={estiloFormulario}>

      <h3>Nova Despesa</h3>

      <div style={estiloCampos}>

        <Campo
  titulo="Data"
  type="date"
  value={novaDespesa.data}
  onChange={(e) =>
    setNovaDespesa({
      ...novaDespesa,
      data: e.target.value
    })
  }
/>

<Campo
  titulo="Descrição"
  value={novaDespesa.descricao}
  onChange={(e) =>
    setNovaDespesa({
      ...novaDespesa,
      descricao: e.target.value
    })
  }
  placeholder="Ex: Pedágio, manutenção, lavagem..."
/>

<Campo
  titulo="Valor"
  type="number"
  value={novaDespesa.valor}
  onChange={(e) =>
    setNovaDespesa({
      ...novaDespesa,
      valor: e.target.value
    })
  }
  placeholder="R$ 0,00"
/>

      </div>

  
<button
  style={estiloBotaoDourado}
  onClick={adicionarDespesa}
>
  + Adicionar Despesa
</button>

    </div>
  {semanaDespesaAberta &&
  semanaDespesaAberta.despesas.length > 0 && (
  <div style={{ marginTop: "30px" }}>

    <h3>Despesas Cadastradas</h3>
    <h3 style={{ marginTop: "10px", marginBottom: "20px" }}>
  Total de Despesas Extras: R${" "}
  {semanaDespesaAberta.despesas
  .reduce((total, despesa) => total + Number(despesa.valor || 0), 0)
  .toFixed(2)
  .replace(".", ",")}
</h3>

    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginTop: "15px"
      }}
    >
      <thead>
        <tr>
          <th style={estiloCelula}>Data</th>
          <th style={estiloCelula}>Descrição</th>
          <th style={estiloCelula}>Valor</th>
          <th style={estiloCelula}>Ações</th>
        </tr>
      </thead>

      <tbody>
        {semanaDespesaAberta?.despesas.map((despesa) => (
          <tr key={despesa.id}>
            <td style={estiloCelula}>
              {despesa.data}
            </td>

            <td style={estiloCelula}>
              {despesa.descricao}
            </td>

            <td style={estiloCelula}>
              R$ {despesa.valor.toFixed(2).replace(".", ",")}
            </td>
            <td style={estiloCelula}>
  <button
    onClick={() => excluirDespesaSemana(despesa.id)}
    style={{
      background: "#dc3545",
      color: "white",
      border: "none",
      padding: "8px 12px",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "bold"
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
)}
  </>
)}
  </div>
)}
        {/* FINANCEIRO */}

{abaAtiva === "financeiro" && (() => {

  const volumeTotalEntregue = semanas.reduce(
    (total, semana) =>
      total +
      semana.viagens.reduce(
        (soma, viagem) =>
          soma + (converterNumero(viagem.volEntregue) || 0),
        0
      ),
    0
  );

  const receitaBruta =
    volumeTotalEntregue * VALOR_POR_VOLUME;

  const pagamentoMotorista =
    receitaBruta * PERCENTUAL_MOTORISTA;

  const valorEmpresa = receitaBruta - pagamentoMotorista;

  return (
    <div>

      <h2>Financeiro</h2>

      <p style={estiloLegenda}>
        Resumo financeiro das operações deste caminhão.
      </p>

      <div style={estiloCardsResumo}>

        <CardResumo
          titulo="Volume Total Entregue"
          valor={formatarNumero(volumeTotalEntregue)}
        />

        <CardResumo
          titulo="Valor por Volume"
          valor={formatarMoeda(VALOR_POR_VOLUME)}
        />

        <CardResumo
          titulo="Receita Bruta"
          valor={formatarMoeda(receitaBruta)}
        />

        <CardResumo
          titulo={`Pagamento do Motorista (${PERCENTUAL_MOTORISTA * 100}%)`}
          valor={formatarMoeda(pagamentoMotorista)}
        />

        <CardResumo
          titulo="Fica para a Empresa"
          valor={formatarMoeda(valorEmpresa)}
        />

      </div>

    </div>
  );

})()}
      </div>
    </div>
  );
}

// =========================
// COMPONENTES
// =========================

function Campo({
  titulo,
  type = "text",
  value,
  onChange,
  placeholder,
  step,
}) {
  return (
    <label style={estiloLabel}>
      {titulo}

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step={step}
        style={estiloInput}
      />
    </label>
  );
}

function CardResumo({ titulo, valor }) {
  return (
    <div style={estiloCardResumo}>
      <span style={estiloLegenda}>{titulo}</span>

      <strong style={estiloNumeroResumo}>
        {valor}
      </strong>
    </div>
  );
}

// =========================
// ESTILOS
// =========================

function estiloAba(ativa) {
  return {
    padding: "15px 20px",
    border: "none",
    borderBottom: ativa
      ? "3px solid #D4A019"
      : "3px solid transparent",
    background: "transparent",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: ativa ? "bold" : "normal",
    color: ativa ? "#D4A019" : "#555",
  };
}

const estiloVoltar = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: "16px",
  marginBottom: "25px",
};

const estiloContainer = {
  background: "white",
  padding: "30px",
  borderRadius: "15px",
  boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
};

const estiloInformacoes = {
  display: "flex",
  gap: "50px",
  marginTop: "25px",
  marginBottom: "35px",
};

const estiloLegenda = {
  color: "#777",
  margin: "5px 0",
};

const estiloMenuAbas = {
  display: "flex",
  gap: "10px",
  borderBottom: "1px solid #ddd",
  marginBottom: "30px",
  flexWrap: "wrap",
};

const estiloCabecalhoSecao = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  marginBottom: "25px",
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

const estiloBotaoEscuro = {
  background: "#111",
  color: "white",
  border: "none",
  padding: "12px 20px",
  borderRadius: "8px",
  cursor: "pointer",
};

const estiloBotaoCancelar = {
  background: "#eee",
  color: "#333",
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

const estiloGridFormulario = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "20px",
  marginTop: "20px",
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
const estiloCelula = {
    padding: "12px",
    border: "1px solid #ddd",
    textAlign: "left"
};
const estiloAcoesFormulario = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "20px",
};

const estiloPreviaDiferenca = {
  marginTop: "20px",
  padding: "12px",
  background: "white",
  borderRadius: "8px",
};

const estiloPreviaValores = {
  marginTop: "25px",
  padding: "20px",
  background: "white",
  borderRadius: "10px",
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "20px",
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
  minWidth: "850px",
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

const estiloCardsResumo = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "20px",
  marginTop: "25px",
};

const estiloCardResumo = {
  border: "1px solid #eee",
  borderRadius: "12px",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const estiloNumeroResumo = {
  fontSize: "24px",
  color: "#D4A019",
};

const estiloResumoFinanceiro = {
  marginTop: "25px",
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "20px",
  padding: "20px",
  background: "#f7f7f7",
  borderRadius: "12px",
};

const estiloValorTotal = {
  fontSize: "20px",
  color: "#D4A019",
};

export default Caminhao;