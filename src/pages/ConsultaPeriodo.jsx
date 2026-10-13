import { useMemo, useState } from "react";
import { formatarData, formatarMoeda, formatarNumero } from "../utils/formatadores";
import {
  calcularTotaisConsulta,
  consultarLancamentosPorPeriodo,
  ESCOPO_CAMINHAO,
  ESCOPO_FROTA_CM,
  ESCOPO_FROTA_TERCEIRIZADA,
  ESCOPO_TODOS,
  filtrarConsultaPorEscopo,
} from "../data/consultaPeriodo";
import { FROTA_BAGACO, FROTA_CM, FROTA_TERCEIRIZADA, FROTAS, unidadeDaFrota } from "../data/caminhoes";
import { TRANSPORTADORA_CM, TRANSPORTADORA_TERCEIRIZADA } from "../data/config";
import PageHeader from "../components/PageHeader";
import "../styles/consultaPeriodo.css";

const comparadorTexto = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

function dataParaExcel(data) {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function tituloFrota(frota) {
  return FROTAS.find((item) => item.tipo === frota)?.titulo || "Frota não identificada";
}

function unidadeVisivel(frota) {
  return frota ? unidadeDaFrota(frota).curta : "unid. não identificada";
}

function idDoRegistro(item) {
  return item.caminhaoId ?? item.caminhao?.id ?? "sem-caminhao";
}

function compararCaminhoes(a, b) {
  return comparadorTexto.compare(a.placa || "", b.placa || "")
    || comparadorTexto.compare(a.modelo || "", b.modelo || "");
}

function compararNF(a, b) {
  const nfA = String(a.nf ?? "").trim();
  const nfB = String(b.nf ?? "").trim();
  if (!nfA && nfB) return 1;
  if (nfA && !nfB) return -1;
  return comparadorTexto.compare(nfA, nfB);
}

function ordenarPorFrotaECaminhao(itens) {
  return [...itens].sort((a, b) => {
    const frotaA = a.caminhao?.frota || "desconhecida";
    const frotaB = b.caminhao?.frota || "desconhecida";
    const ordemFrota = comparadorTexto.compare(tituloFrota(frotaA), tituloFrota(frotaB));
    if (ordemFrota) return ordemFrota;

    const ordemCaminhao = compararCaminhoes(a.caminhao || {}, b.caminhao || {});
    if (ordemCaminhao) return ordemCaminhao;
    if (a.tipo === "viagem" && b.tipo === "viagem") {
      return compararNF(a, b);
    }
    return 0;
  });
}

function agruparCaminhoes(consulta) {
  const caminhoes = new Map((consulta.caminhoes || []).map((caminhao) => [String(caminhao.id), caminhao]));
  const listas = {
    viagens: consulta.viagens || [],
    abastecimentos: consulta.abastecimentos || [],
    despesasCaminhao: consulta.despesasCaminhao || [],
    icms: consulta.icms || [],
  };

  Object.values(listas).flat().forEach((item) => {
    const id = idDoRegistro(item);
    if (!caminhoes.has(String(id))) {
      caminhoes.set(String(id), item.caminhao || {
        id,
        modelo: "Caminhão não identificado",
        placa: "",
        motorista: "",
        frota: null,
      });
    }
  });

  return [...caminhoes.values()].sort(compararCaminhoes).map((caminhao) => {
    const registros = Object.fromEntries(Object.entries(listas).map(([chave, itens]) => [
      chave,
      itens.filter((item) => String(idDoRegistro(item)) === String(caminhao.id)),
    ]));
    return {
      caminhao,
      registros,
      totais: calcularTotaisConsulta({ ...registros, caminhoes: [caminhao], despesasGerais: [] }),
    };
  });
}

function criarDadosRelatorio(consulta, escopo, rotuloEscopo) {
  const viagens = [...consulta.viagens].map((viagem) => {
    const diferenca = Number((viagem.volumeEntregue - viagem.volumeFiscal).toFixed(2));
    return {
      ...viagem,
      diferenca,
      transportadora: viagem.caminhao?.frota === FROTA_TERCEIRIZADA
        ? TRANSPORTADORA_TERCEIRIZADA
        : TRANSPORTADORA_CM,
      complemento: diferenca * viagem.taxa,
      valorFisico: viagem.valorEntregue,
    };
  });
  const viagensBagaco = viagens.filter((viagem) => viagem.caminhao?.frota === FROTA_BAGACO);
  const viagensVolume = viagens.filter((viagem) => [FROTA_CM, FROTA_TERCEIRIZADA].includes(viagem.caminhao?.frota));
  const viagensUnidadeDesconhecida = viagens.filter((viagem) => ![FROTA_CM, FROTA_TERCEIRIZADA, FROTA_BAGACO].includes(viagem.caminhao?.frota));
  const somarViagens = (itens, campo) => itens.reduce((total, viagem) => total + (Number(viagem[campo]) || 0), 0);
  const totaisRelatorio = {
    volumeFiscalM3: somarViagens(viagensVolume, "volumeFiscal"),
    volumeEntregueM3: somarViagens(viagensVolume, "volumeEntregue"),
    diferencaM3: somarViagens(viagensVolume, "diferenca"),
    volumeFiscalTon: somarViagens(viagensBagaco, "volumeFiscal"),
    volumeEntregueTon: somarViagens(viagensBagaco, "volumeEntregue"),
    diferencaTon: somarViagens(viagensBagaco, "diferenca"),
    volumeFiscalUnidadeDesconhecida: somarViagens(viagensUnidadeDesconhecida, "volumeFiscal"),
    volumeEntregueUnidadeDesconhecida: somarViagens(viagensUnidadeDesconhecida, "volumeEntregue"),
    diferencaUnidadeDesconhecida: somarViagens(viagensUnidadeDesconhecida, "diferenca"),
    valorFiscal: somarViagens(viagens, "valorFiscal"),
    complemento: somarViagens(viagens, "complemento"),
    valorFisico: somarViagens(viagens, "valorFisico"),
  };

  return {
    ...consulta,
    viagens,
    escopoRelatorio: escopo,
    rotuloEscopo,
    totais: calcularTotaisConsulta({ ...consulta, viagens }),
    totaisRelatorio,
  };
}

function camposCaminhao(caminhao) {
  return [
    tituloFrota(caminhao?.frota),
    caminhao?.modelo || "Caminhão",
    caminhao?.placa || "Sem placa",
    caminhao?.motorista || "Não informado",
  ];
}

async function exportarExcel(relatorio) {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) throw new Error("O gerador ExcelJS não está disponível. Recarregue a página e tente novamente.");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "C&M Control";
  workbook.created = new Date();
  const periodo = `${formatarData(relatorio.inicio)} a ${formatarData(relatorio.fim)}`;
  const baseColunas = ["Frota", "Caminhão", "Placa", "Motorista"];
  const viagensOrdenadas = ordenarPorFrotaECaminhao(relatorio.viagens);
  const folhas = [
    {
      nome: "Viagens",
      itens: viagensOrdenadas,
      colunas: [...baseColunas, "Unidade", "Nº NF", "Data NF", "Vol. fiscal", "Vol. entregue", "Diferença", "CT-e", "Transportadora", "Frete R$/unid.", "Valor fiscal (R$)", "Complemento (R$)", "Valor físico (R$)", "Data transporte"],
      linha: (v) => [...camposCaminhao(v.caminhao), unidadeDaFrota(v.caminhao?.frota).curta, v.nf || "", dataParaExcel(v.data), v.volumeFiscal, v.volumeEntregue, v.diferenca, v.cte || "", v.transportadora, v.taxa, v.valorFiscal, v.complemento, v.valorFisico, dataParaExcel(v.dataEntrega)],
      colunasData: [7, 17],
    },
    {
      nome: "Abastecimentos",
      itens: ordenarPorFrotaECaminhao(relatorio.abastecimentos),
      colunas: [...baseColunas, "Data", "Posto", "KM", "Litros diesel", "Litros ARLA", "Valor total"],
      linha: (v) => [...camposCaminhao(v.caminhao), dataParaExcel(v.data), v.posto || "", v.km ?? "", v.litrosDiesel ?? "", v.litrosArla ?? "", Number(v.valorTotal) || 0],
      colunasData: [5],
    },
    {
      nome: "Despesas caminhão",
      itens: ordenarPorFrotaECaminhao(relatorio.despesasCaminhao),
      colunas: [...baseColunas, "Data", "Descrição", "Valor"],
      linha: (v) => [...camposCaminhao(v.caminhao), dataParaExcel(v.data), v.descricao || "", Number(v.valor) || 0],
      colunasData: [5],
    },
    {
      nome: "ICMS",
      itens: ordenarPorFrotaECaminhao(relatorio.icms),
      colunas: [...baseColunas, "Data", "CT-e", "Valor"],
      linha: (v) => [...camposCaminhao(v.caminhao), dataParaExcel(v.data), v.cte || "", Number(v.valor) || 0],
      colunasData: [5],
    },
  ];
  if (relatorio.escopoRelatorio === ESCOPO_TODOS) {
    folhas.push({
      nome: "Despesas gerais",
      itens: relatorio.despesasGerais,
      colunas: ["Data", "Descrição", "Valor"],
      linha: (v) => [dataParaExcel(v.data), v.descricao || "", Number(v.valor) || 0],
      colunasData: [1],
    });
  }

  const resumo = workbook.addWorksheet("Resumo");
  const linhasResumo = [
    ["C&M CONTROL — RELATÓRIO POR PERÍODO", periodo],
    ["Escopo", relatorio.rotuloEscopo],
    ["Indicador", "Total"],
    ["Viagens", relatorio.totais.quantidadeViagens],
    ["Volume entregue (m³)", relatorio.totais.volumeEntregueM3],
    ["Toneladas entregues (t)", relatorio.totais.toneladasEntregues],
    ["Receita bruta", relatorio.totais.receitaBruta],
    ["Combustível", relatorio.totais.combustivel],
    ["Despesas dos caminhões", relatorio.totais.despesasCaminhao],
    ["ICMS lançado", relatorio.totais.icms],
  ];
  if (relatorio.escopoRelatorio === ESCOPO_TODOS) {
    linhasResumo.push(["Despesas gerais da empresa", relatorio.totais.despesasGerais]);
  }
  if (relatorio.totais.volumeUnidadeDesconhecida) {
    linhasResumo.push(["Volume entregue (unidade não identificada)", relatorio.totais.volumeUnidadeDesconhecida]);
  }
  resumo.addRows(linhasResumo);
  resumo.getRow(1).font = { bold: true };
  resumo.getRow(3).font = { bold: true };
  resumo.columns = [{ width: 32 }, { width: 30 }];

  const abaCaminhoes = workbook.addWorksheet("Por caminhão");
  abaCaminhoes.addRow(["C&M CONTROL — TOTAIS POR CAMINHÃO", periodo]);
  abaCaminhoes.addRow(["Frota", "Caminhão", "Placa", "Motorista", "Viagens", "Unidade", "Volume entregue", "Receita bruta (R$)", "Abastecimentos (R$)", "Despesas do caminhão (R$)", "ICMS (R$)"]);
  agruparCaminhoes(relatorio)
    .sort((a, b) => comparadorTexto.compare(tituloFrota(a.caminhao.frota), tituloFrota(b.caminhao.frota)) || compararCaminhoes(a.caminhao, b.caminhao))
    .forEach(({ caminhao, totais }) => {
    const bagaco = caminhao.frota === FROTA_BAGACO;
    const unidade = unidadeVisivel(caminhao.frota);
    abaCaminhoes.addRow([
      tituloFrota(caminhao.frota), caminhao.modelo || "Caminhão", caminhao.placa || "", caminhao.motorista || "",
      totais.quantidadeViagens, unidade,
      bagaco ? totais.toneladasEntregues : caminhao.frota ? totais.volumeEntregueM3 : totais.volumeUnidadeDesconhecida,
      totais.receitaBruta, totais.combustivel, totais.despesasCaminhao, totais.icms,
    ]);
    });
  abaCaminhoes.getRow(1).font = { bold: true };
  abaCaminhoes.getRow(2).font = { bold: true };

  for (const folha of folhas) {
    const sheet = workbook.addWorksheet(folha.nome);
    sheet.addRow(["C&M CONTROL — CONSULTA POR PERÍODO", periodo]);
    sheet.addRow(["Escopo", relatorio.rotuloEscopo]);
    sheet.addRow(folha.colunas);
    folha.itens.forEach((item) => sheet.addRow(folha.linha(item)));
    folha.colunasData.forEach((indice) => { sheet.getColumn(indice).numFmt = "dd/mm/yyyy"; });
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(3).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    sheet.columns.forEach((coluna) => { coluna.width = Math.min(Math.max(coluna.header?.length || 14, 14), 30); });
  }
  abaCaminhoes.views = [{ state: "frozen", ySplit: 2 }];
  abaCaminhoes.columns.forEach((coluna) => { coluna.width = Math.min(Math.max(coluna.header?.length || 14, 14), 30); });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Relatorio_${relatorio.inicio}_a_${relatorio.fim}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Tabela({ titulo, colunas, itens, linha }) {
  return (
    <section className="consulta-registros">
      <h4>{titulo} <span className="consulta-contagem">{itens.length}</span></h4>
      {!itens.length ? <p className="consulta-vazio">Nenhum lançamento encontrado no período.</p> : <div className="consulta-tabela-scroll">
        <table className="consulta-tabela">
          <thead><tr>{colunas.map((coluna) => <th key={coluna}>{coluna}</th>)}</tr></thead>
          <tbody>{itens.map((item, indice) => <tr key={`${item.tipo}-${item.id ?? indice}`}>{linha(item)}</tr>)}</tbody>
        </table>
      </div>}
    </section>
  );
}

function Resumo({ titulo, valor }) {
  return <article className="consulta-resumo-card"><span>{titulo}</span><strong>{valor}</strong></article>;
}

function CaminhaoCard({ grupo }) {
  const { caminhao, registros, totais } = grupo;
  const unidade = unidadeVisivel(caminhao.frota);
  const viagens = registros.viagens;
  const viagemComCamposRelatorio = Boolean(viagens[0] && Object.hasOwn(viagens[0], "complemento"));
  return (
    <article className="consulta-caminhao-card">
      <header className="consulta-caminhao-cabecalho">
        <div>
          <h3>{caminhao.modelo || "Caminhão não identificado"}</h3>
          <p>Placa: <strong>{caminhao.placa || "Não identificada"}</strong>
            {caminhao.motorista && <> · Motorista: <strong>{caminhao.motorista}</strong></>}</p>
        </div>
        <span className={`consulta-frota-etiqueta ${caminhao.frota === FROTA_BAGACO ? "bagaco" : ""}`}>
          {tituloFrota(caminhao.frota)}
        </span>
      </header>
      <div className="consulta-caminhao-totais" aria-label="Totais do caminhão no período">
        <Resumo titulo="Viagens" valor={totais.quantidadeViagens} />
        <Resumo titulo={`Entregue (${unidade})`} valor={formatarNumero(caminhao.frota === FROTA_BAGACO ? totais.toneladasEntregues : caminhao.frota ? totais.volumeEntregueM3 : totais.volumeUnidadeDesconhecida)} />
        <Resumo titulo="Valor bruto" valor={formatarMoeda(totais.receitaBruta)} />
        <Resumo titulo="Abastecimentos" valor={formatarMoeda(totais.combustivel)} />
        <Resumo titulo="Despesas do caminhão" valor={formatarMoeda(totais.despesasCaminhao)} />
        {registros.icms.length > 0 && <Resumo titulo="ICMS" valor={formatarMoeda(totais.icms)} />}
      </div>
      {!viagens.length && !registros.abastecimentos.length && !registros.despesasCaminhao.length && !registros.icms.length
        ? <p className="consulta-vazio">Nenhum lançamento encontrado para este caminhão no período.</p>
        : <div className="consulta-caminhao-registros">
          {viagens.length > 0 && <Tabela
            titulo="Viagens (NF crescente)"
            colunas={viagemComCamposRelatorio
              ? ["Nº NF", "Placa", "Data NF", "Vol. fiscal", "Vol. entregue", "Diferença", "CT-e", "Transportadora", "Frete R$/unid.", "Valor fiscal", "Complemento", "Valor físico", "Data transporte"]
              : ["Nº NF", "Data de entrega", "Placa", "Vol. fiscal", "Vol. entregue", "CT-e", "Frete/unid.", "Valor fiscal", "Valor físico", "Data transporte"]}
            itens={viagens}
            linha={(v) => <>
              <td>{v.nf || "—"}</td>
              {viagemComCamposRelatorio && <td>{caminhao.placa || "—"}</td>}
              <td>{formatarData(v.data)}</td>
              {!viagemComCamposRelatorio && <td>{caminhao.placa || "—"}</td>}
              <td>{formatarNumero(v.volumeFiscal)} {unidade}</td><td>{formatarNumero(v.volumeEntregue)} {unidade}</td>
              {viagemComCamposRelatorio && <td>{formatarNumero(v.diferenca)} {unidade}</td>}
              <td>{v.cte || "—"}</td>
              {viagemComCamposRelatorio && <td>{v.transportadora}</td>}
              <td>{formatarMoeda(v.taxa)}</td><td>{formatarMoeda(v.valorFiscal)}</td>
              {viagemComCamposRelatorio
                ? <><td>{formatarMoeda(v.complemento)}</td><td>{formatarMoeda(v.valorFisico)}</td></>
                : <td>{formatarMoeda(v.valorEntregue)}</td>}
              <td>{formatarData(v.dataEntrega)}</td>
            </>}
          />}
          {registros.abastecimentos.length > 0 && <Tabela titulo="Abastecimentos" colunas={["Data", "Posto", "KM", "Diesel (L)", "ARLA (L)", "Total"]} itens={registros.abastecimentos} linha={(v) => <>
            <td>{formatarData(v.data)}</td><td>{v.posto || "—"}</td><td>{v.km ?? "—"}</td><td>{v.litrosDiesel ?? "—"}</td><td>{v.litrosArla ?? "—"}</td><td>{formatarMoeda(v.valorTotal)}</td>
          </>} />}
          {registros.despesasCaminhao.length > 0 && <Tabela titulo="Despesas do caminhão" colunas={["Data", "Descrição", "Valor"]} itens={registros.despesasCaminhao} linha={(v) => <>
            <td>{formatarData(v.data)}</td><td>{v.descricao || "—"}</td><td>{formatarMoeda(v.valor)}</td>
          </>} />}
          {registros.icms.length > 0 && <Tabela titulo="ICMS" colunas={["Data", "CT-e", "Valor"]} itens={registros.icms} linha={(v) => <>
            <td>{formatarData(v.data)}</td><td>{v.cte || "—"}</td><td>{formatarMoeda(v.valor)}</td>
          </>} />}
        </div>}
    </article>
  );
}

function ConsultaPeriodo() {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [consulta, setConsulta] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [escopo, setEscopo] = useState(ESCOPO_TODOS);
  const [caminhaoSelecionado, setCaminhaoSelecionado] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const dadosEscopo = useMemo(
    () => consulta ? filtrarConsultaPorEscopo(consulta, escopo, caminhaoSelecionado) : null,
    [consulta, escopo, caminhaoSelecionado]
  );
  const dadosExibidos = relatorio || dadosEscopo;
  const gruposCaminhoes = useMemo(() => dadosExibidos ? agruparCaminhoes(dadosExibidos) : [], [dadosExibidos]);
  const caminhoesDoEscopo = consulta?.caminhoes || [];
  const caminhaoAtual = caminhoesDoEscopo.find((item) => String(item.id) === String(caminhaoSelecionado));
  const exibirCm = escopo === ESCOPO_TODOS || escopo === ESCOPO_FROTA_CM
    || (escopo === ESCOPO_CAMINHAO && [FROTA_CM, FROTA_BAGACO].includes(caminhaoAtual?.frota));
  const exibirTerceirizada = escopo === ESCOPO_TODOS || escopo === ESCOPO_FROTA_TERCEIRIZADA
    || (escopo === ESCOPO_CAMINHAO && caminhaoAtual?.frota === FROTA_TERCEIRIZADA);
  const rotuloEscopo = escopo === ESCOPO_TODOS
    ? "Todos os caminhões"
    : escopo === ESCOPO_FROTA_CM
      ? "Frota C&M (inclui Bagaço de Cana)"
      : escopo === ESCOPO_FROTA_TERCEIRIZADA
        ? "Frota Terceirizada"
        : caminhaoAtual
          ? `${caminhaoAtual.placa || "Sem placa"} — ${caminhaoAtual.modelo || "Caminhão"}${caminhaoAtual.motorista ? ` — ${caminhaoAtual.motorista}` : ""}`
          : "Selecione um caminhão";
  const gerarDesabilitado = !consulta || carregando || (escopo === ESCOPO_CAMINHAO && !caminhaoSelecionado);

  async function consultar(evento) {
    evento.preventDefault();
    setErro("");
    if (!inicio || !fim) {
      setErro("Informe a data inicial e a data final.");
      return;
    }
    if (inicio > fim) {
      setErro("A data inicial deve ser anterior ou igual à data final.");
      return;
    }
    setCarregando(true);
    setConsulta(null);
    setRelatorio(null);
    setEscopo(ESCOPO_TODOS);
    setCaminhaoSelecionado("");
    try {
      setConsulta(await consultarLancamentosPorPeriodo(inicio, fim));
    } catch (e) {
      setErro(`Não foi possível consultar os lançamentos: ${e.message}`);
      setConsulta(null);
    } finally {
      setCarregando(false);
    }
  }

  function mudarEscopo(novoEscopo) {
    setEscopo(novoEscopo);
    setCaminhaoSelecionado("");
    setRelatorio(null);
  }

  function mudarCaminhao(id) {
    setCaminhaoSelecionado(id);
    setRelatorio(null);
  }

  function gerarRelatorio() {
    if (!dadosEscopo || gerarDesabilitado) return;
    setErro("");
    setRelatorio(criarDadosRelatorio(dadosEscopo, escopo, rotuloEscopo));
  }

  async function baixarExcel() {
    try { await exportarExcel(relatorio); }
    catch (e) { setErro(e.message); }
  }

  function listaCaminhoes(frota) {
    return gruposCaminhoes.filter((grupo) => grupo.caminhao.frota === frota);
  }

  return (
    <div className="consulta-periodo">
      <PageHeader titulo="Consulta por Período" subtitulo="Consulte lançamentos pela data em que ocorreram, sem depender do fechamento semanal." />
      <form className="consulta-filtros sem-impressao" onSubmit={consultar}>
        <label>Data inicial<input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required /><span className="consulta-data-legenda">{inicio ? formatarData(inicio) : "DD/MM/AAAA"}</span></label>
        <label>Data final<input type="date" value={fim} onChange={(e) => setFim(e.target.value)} min={inicio || undefined} required /><span className="consulta-data-legenda">{fim ? formatarData(fim) : "DD/MM/AAAA"}</span></label>
        <button type="submit" disabled={carregando}>{carregando ? "Consultando…" : "Consultar"}</button>
      </form>
      {erro && <p className="consulta-erro" role="alert">{erro}</p>}
      {consulta && dadosExibidos && <>
        <section className="consulta-selecao-escopo sem-impressao" aria-label="Controles do relatório">
          <label>Escopo do Relatório
            <select value={escopo} onChange={(e) => mudarEscopo(e.target.value)}>
              <option value={ESCOPO_TODOS}>Todos os caminhões</option>
              <option value={ESCOPO_FROTA_CM}>Frota C&M</option>
              <option value={ESCOPO_FROTA_TERCEIRIZADA}>Frota Terceirizada</option>
              <option value={ESCOPO_CAMINHAO}>Caminhão específico</option>
            </select>
          </label>
          {escopo === ESCOPO_CAMINHAO && <label>Caminhão
            <select value={caminhaoSelecionado} onChange={(e) => mudarCaminhao(e.target.value)}>
              <option value="">Selecione placa, modelo e motorista</option>
              {caminhoesDoEscopo.slice().sort(compararCaminhoes).map((caminhao) => (
                <option key={caminhao.id} value={caminhao.id}>
                  {caminhao.placa || "Sem placa"} — {caminhao.modelo || "Caminhão"}{caminhao.motorista ? ` — ${caminhao.motorista}` : ""}
                </option>
              ))}
            </select>
          </label>}
          <div className="consulta-acoes">
            <button type="button" onClick={gerarRelatorio} disabled={gerarDesabilitado}>Gerar Relatório</button>
            {relatorio && <button type="button" onClick={baixarExcel}>Baixar Excel</button>}
            <button type="button" className="consulta-botao-secundario" onClick={() => window.print()}>Salvar como PDF</button>
          </div>
        </section>

        <div className="consulta-periodo-titulo">
          <div>
            <h2>{relatorio ? "Prévia do Relatório" : "Resultados"} · {formatarData(dadosExibidos.inicio)} a {formatarData(dadosExibidos.fim)}</h2>
            <p>Escopo: <strong>{dadosExibidos.rotuloEscopo || rotuloEscopo}</strong></p>
          </div>
        </div>
        {relatorio && <p className="consulta-relatorio-legenda">Prévia gerada com os lançamentos já carregados e filtrados nesta consulta.</p>}

        <section className="consulta-resumo" aria-label="Resumo do escopo selecionado">
          <Resumo titulo="Viagens" valor={dadosExibidos.totais.quantidadeViagens} />
          <Resumo titulo="Volume entregue (m³)" valor={formatarNumero(dadosExibidos.totais.volumeEntregueM3)} />
          <Resumo titulo="Toneladas entregues (t)" valor={formatarNumero(dadosExibidos.totais.toneladasEntregues)} />
          {dadosExibidos.totais.volumeUnidadeDesconhecida > 0 && <Resumo titulo="Volume (unidade não identificada)" valor={formatarNumero(dadosExibidos.totais.volumeUnidadeDesconhecida)} />}
          <Resumo titulo="Receita bruta" valor={formatarMoeda(dadosExibidos.totais.receitaBruta)} />
          <Resumo titulo="Combustível" valor={formatarMoeda(dadosExibidos.totais.combustivel)} />
          <Resumo titulo="Despesas dos caminhões" valor={formatarMoeda(dadosExibidos.totais.despesasCaminhao)} />
          {escopo === ESCOPO_TODOS && <Resumo titulo="Despesas gerais da empresa" valor={formatarMoeda(dadosExibidos.totais.despesasGerais)} />}
          <Resumo titulo="ICMS lançado" valor={formatarMoeda(dadosExibidos.totais.icms)} />
        </section>

        {exibirCm && <section className="consulta-frota-grupo">
          <header><h2>Frota C&M</h2><p>{listaCaminhoes(FROTA_CM).length} caminhões</p></header>
          {listaCaminhoes(FROTA_CM).map((grupo) => <CaminhaoCard key={grupo.caminhao.id} grupo={grupo} />)}
          {listaCaminhoes(FROTA_BAGACO).length > 0 && <section className="consulta-subfrota">
            <header><h3>Frota de Bagaço de Cana</h3><p>Volumes exibidos em toneladas (t), separados de m³.</p></header>
            {listaCaminhoes(FROTA_BAGACO).map((grupo) => <CaminhaoCard key={grupo.caminhao.id} grupo={grupo} />)}
          </section>}
          {!listaCaminhoes(FROTA_CM).length && !listaCaminhoes(FROTA_BAGACO).length && <p className="consulta-vazio">Nenhum caminhão da Frota C&M neste escopo.</p>}
        </section>}

        {exibirTerceirizada && <section className="consulta-frota-grupo">
          <header><h2>Frota Terceirizada</h2><p>{listaCaminhoes(FROTA_TERCEIRIZADA).length} caminhões</p></header>
          {listaCaminhoes(FROTA_TERCEIRIZADA).map((grupo) => <CaminhaoCard key={grupo.caminhao.id} grupo={grupo} />)}
          {!listaCaminhoes(FROTA_TERCEIRIZADA).length && <p className="consulta-vazio">Nenhum caminhão terceirizado neste escopo.</p>}
        </section>}

        {gruposCaminhoes.some((grupo) => !grupo.caminhao.frota) && <section className="consulta-frota-grupo">
          <header><h2>Frota não identificada</h2></header>
          {gruposCaminhoes.filter((grupo) => !grupo.caminhao.frota).map((grupo) => <CaminhaoCard key={grupo.caminhao.id} grupo={grupo} />)}
        </section>}

        {escopo === ESCOPO_TODOS && <section className="consulta-card consulta-despesas-gerais">
          <header><h2>Despesas Gerais da Empresa</h2><span className="consulta-contagem">{dadosExibidos.despesasGerais.length}</span></header>
          <Tabela titulo="Registros" colunas={["Data", "Descrição", "Valor"]} itens={dadosExibidos.despesasGerais} linha={(v) => <>
            <td>{formatarData(v.data)}</td><td>{v.descricao || "—"}</td><td>{formatarMoeda(v.valor)}</td>
          </>} />
        </section>}
      </>}
    </div>
  );
}

export default ConsultaPeriodo;
