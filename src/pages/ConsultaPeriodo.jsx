import { useState } from "react";
import { formatarData, formatarMoeda, formatarNumero } from "../utils/formatadores";
import { consultarLancamentosPorPeriodo } from "../data/consultaPeriodo";
import { FROTA_TERCEIRIZADA } from "../data/caminhoes";
import { TRANSPORTADORA_CM, TRANSPORTADORA_TERCEIRIZADA } from "../data/config";
import PageHeader from "../components/PageHeader";
import "../styles/consultaPeriodo.css";

function identificacaoCaminhao(item) {
  if (!item.caminhao) return "Despesas gerais";
  return `${item.caminhao.modelo || "Caminhão"} (${item.caminhao.placa || "sem placa"})`;
}

function dataParaExcel(data) {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function criarDadosRelatorio(consulta) {
  const viagens = consulta.viagens.map((viagem) => {
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

  const totais = viagens.reduce((soma, viagem) => ({
    volumeFiscal: soma.volumeFiscal + viagem.volumeFiscal,
    volumeEntregue: soma.volumeEntregue + viagem.volumeEntregue,
    diferenca: soma.diferenca + viagem.diferenca,
    valorFiscal: soma.valorFiscal + viagem.valorFiscal,
    complemento: soma.complemento + viagem.complemento,
    valorFisico: soma.valorFisico + viagem.valorFisico,
  }), {
    volumeFiscal: 0,
    volumeEntregue: 0,
    diferenca: 0,
    valorFiscal: 0,
    complemento: 0,
    valorFisico: 0,
  });
  totais.volumeEntregue = Number(totais.volumeEntregue.toFixed(2));
  totais.diferenca = Number(totais.diferenca.toFixed(2));

  return { ...consulta, viagens, totaisRelatorio: totais };
}

async function exportarExcel(relatorio) {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) throw new Error("O gerador ExcelJS não está disponível. Recarregue a página e tente novamente.");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "C&M Control";
  workbook.created = new Date();
  const periodo = `${formatarData(relatorio.inicio)} a ${formatarData(relatorio.fim)}`;
  const viagemCols = [
    "Nº NF", "PLACA", "DATA NF", "VOL. FISCAL", "VOL. ENTREGUE", "DIFERENÇA",
    "CT-E", "TRANSPORTADORA", "FRETE R$/UNID.", "VALOR FISCAL (R$)",
    "COMPLEMENTO (R$)", "VALOR FÍSICO (R$)", "DATA TRANSPORTE",
  ];
  const folhas = [
    {
      nome: "Viagens",
      itens: relatorio.viagens,
      colunas: viagemCols,
      linha: (v) => [v.nf || "", v.caminhao?.placa || "", dataParaExcel(v.data), v.volumeFiscal, v.volumeEntregue, v.diferenca, v.cte || "", v.transportadora, v.taxa, v.valorFiscal, v.complemento, v.valorFisico, dataParaExcel(v.dataEntrega)],
      colunasData: [3, 13],
      total: ["TOTAL GERAL", "", "", relatorio.totaisRelatorio.volumeFiscal, relatorio.totaisRelatorio.volumeEntregue, relatorio.totaisRelatorio.diferenca, "", "", "", relatorio.totaisRelatorio.valorFiscal, relatorio.totaisRelatorio.complemento, relatorio.totaisRelatorio.valorFisico, ""],
    },
    {
      nome: "Abastecimentos",
      itens: relatorio.abastecimentos,
      colunas: ["Data", "Caminhão", "Posto", "KM", "Litros diesel", "Litros ARLA", "Valor total"],
      linha: (v) => [dataParaExcel(v.data), identificacaoCaminhao(v), v.posto || "", v.km ?? "", v.litrosDiesel ?? "", v.litrosArla ?? "", Number(v.valorTotal) || 0],
      colunasData: [1],
    },
    {
      nome: "Despesas caminhão",
      itens: relatorio.despesasCaminhao,
      colunas: ["Data", "Caminhão", "Descrição", "Valor"],
      linha: (v) => [dataParaExcel(v.data), identificacaoCaminhao(v), v.descricao || "", Number(v.valor) || 0],
      colunasData: [1],
    },
    {
      nome: "Despesas gerais",
      itens: relatorio.despesasGerais,
      colunas: ["Data", "Descrição", "Valor"],
      linha: (v) => [dataParaExcel(v.data), v.descricao || "", Number(v.valor) || 0],
      colunasData: [1],
    },
    {
      nome: "ICMS",
      itens: relatorio.icms,
      colunas: ["Data", "Caminhão", "CT-e", "Valor"],
      linha: (v) => [dataParaExcel(v.data), identificacaoCaminhao(v), v.cte || "", Number(v.valor) || 0],
      colunasData: [1],
    },
  ];

  const resumo = workbook.addWorksheet("Resumo");
  resumo.addRows([
    ["C&M CONTROL — RELATÓRIO POR PERÍODO", periodo],
    ["Indicador", "Total"],
    ["Viagens", relatorio.totais.quantidadeViagens],
    ["Volume entregue", relatorio.totais.volumeEntregue],
    ["Receita bruta", relatorio.totais.receitaBruta],
    ["Combustível", relatorio.totais.combustivel],
    ["Despesas dos caminhões", relatorio.totais.despesasCaminhao],
    ["Despesas gerais", relatorio.totais.despesasGerais],
    ["ICMS lançado", relatorio.totais.icms],
  ]);
  resumo.getRow(1).font = { bold: true };
  resumo.getRow(2).font = { bold: true };
  resumo.columns = [{ width: 30 }, { width: 24 }];

  for (const folha of folhas) {
    const sheet = workbook.addWorksheet(folha.nome);
    sheet.addRow(["C&M CONTROL — CONSULTA POR PERÍODO", periodo]);
    sheet.addRow(folha.colunas);
    folha.itens.forEach((item) => sheet.addRow(folha.linha(item)));
    if (folha.total) sheet.addRow(folha.total);
    folha.colunasData.forEach((indice) => {
      sheet.getColumn(indice).numFmt = "dd/mm/yyyy";
    });
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 2 }];
    sheet.columns.forEach((coluna) => { coluna.width = Math.min(Math.max(coluna.header?.length || 14, 14), 30); });
  }

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

function Tabela({ titulo, colunas, itens, linha, rodape }) {
  return (
    <section className="consulta-card">
      <h2>{titulo} <span className="consulta-contagem">{itens.length}</span></h2>
      {!itens.length ? <p className="consulta-vazio">Nenhum lançamento no intervalo.</p> : (
        <div className="consulta-tabela-scroll">
          <table className="consulta-tabela">
            <thead><tr>{colunas.map((coluna) => <th key={coluna}>{coluna}</th>)}</tr></thead>
            <tbody>{itens.map((item, indice) => <tr key={`${item.tipo}-${item.caminhaoId || "geral"}-${item.id ?? indice}`}>{linha(item)}</tr>)}</tbody>
            {rodape && <tfoot>{rodape}</tfoot>}
          </table>
        </div>
      )}
    </section>
  );
}

function ConsultaPeriodo() {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [consulta, setConsulta] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

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
    try {
      setConsulta(await consultarLancamentosPorPeriodo(inicio, fim));
    } catch (e) {
      setErro(`Não foi possível consultar os lançamentos: ${e.message}`);
      setConsulta(null);
    } finally {
      setCarregando(false);
    }
  }

  async function baixarExcel() {
    try { await exportarExcel(relatorio); }
    catch (e) { setErro(e.message); }
  }

  function gerarRelatorio() {
    if (consulta) setRelatorio(criarDadosRelatorio(consulta));
  }

  const dadosExibidos = relatorio || consulta;

  return (
    <div className="consulta-periodo">
      <PageHeader titulo="Consulta por Período" subtitulo="Consulte lançamentos pela data em que ocorreram, sem depender do fechamento semanal." />
      <form className="consulta-filtros sem-impressao" onSubmit={consultar}>
        <label>Data inicial<input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required /><span className="consulta-data-legenda">{inicio ? formatarData(inicio) : "DD/MM/AAAA"}</span></label>
        <label>Data final<input type="date" value={fim} onChange={(e) => setFim(e.target.value)} min={inicio || undefined} required /><span className="consulta-data-legenda">{fim ? formatarData(fim) : "DD/MM/AAAA"}</span></label>
        <button type="submit" disabled={carregando}>{carregando ? "Consultando…" : "Consultar"}</button>
      </form>
      {erro && <p className="consulta-erro" role="alert">{erro}</p>}
      {dadosExibidos && <>
        <div className="consulta-periodo-titulo">
          <h2>{relatorio ? "Relatório" : "Resultados"} de {formatarData(dadosExibidos.inicio)} a {formatarData(dadosExibidos.fim)}</h2>
          <div className="consulta-acoes sem-impressao">
            {relatorio && <button type="button" onClick={baixarExcel}>Baixar Excel</button>}
            {consulta && <button type="button" onClick={gerarRelatorio}>Gerar Relatório</button>}
            <button type="button" className="consulta-botao-secundario" onClick={() => window.print()}>Salvar como PDF</button>
          </div>
        </div>
        {relatorio && <h3 className="consulta-relatorio-legenda">Relatório gerado a partir dos lançamentos exibidos nesta consulta.</h3>}
        <section className="consulta-resumo" aria-label="Resumo do intervalo">
          <Resumo titulo="Viagens" valor={dadosExibidos.totais.quantidadeViagens} />
          <Resumo titulo="Volume entregue" valor={formatarNumero(dadosExibidos.totais.volumeEntregue)} />
          <Resumo titulo="Receita bruta" valor={formatarMoeda(dadosExibidos.totais.receitaBruta)} />
          <Resumo titulo="Combustível" valor={formatarMoeda(dadosExibidos.totais.combustivel)} />
          <Resumo titulo="Despesas dos caminhões" valor={formatarMoeda(dadosExibidos.totais.despesasCaminhao)} />
          <Resumo titulo="Despesas gerais" valor={formatarMoeda(dadosExibidos.totais.despesasGerais)} />
          <Resumo titulo="ICMS lançado" valor={formatarMoeda(dadosExibidos.totais.icms)} />
        </section>
        {relatorio ? (
          <Tabela titulo="Viagens (ordenadas por NF crescente)" colunas={["Nº NF", "Placa", "Data NF", "Vol. fiscal", "Vol. entregue", "Diferença", "CT-e", "Transportadora", "Frete R$/unid.", "Valor fiscal", "Complemento", "Valor físico", "Data transporte"]} itens={relatorio.viagens} linha={(v) => <>
            <td>{v.nf || "—"}</td><td>{v.caminhao?.placa || "—"}</td><td>{formatarData(v.data)}</td><td>{formatarNumero(v.volumeFiscal)}</td><td>{formatarNumero(v.volumeEntregue)}</td><td>{formatarNumero(v.diferenca)}</td><td>{v.cte || "—"}</td><td>{v.transportadora}</td><td>{formatarMoeda(v.taxa)}</td><td>{formatarMoeda(v.valorFiscal)}</td><td>{formatarMoeda(v.complemento)}</td><td>{formatarMoeda(v.valorFisico)}</td><td>{formatarData(v.dataEntrega)}</td>
          </>} rodape={<tr><td colSpan={3}>TOTAL GERAL</td><td>{formatarNumero(relatorio.totaisRelatorio.volumeFiscal)}</td><td>{formatarNumero(relatorio.totaisRelatorio.volumeEntregue)}</td><td>{formatarNumero(relatorio.totaisRelatorio.diferenca)}</td><td colSpan={3}></td><td>{formatarMoeda(relatorio.totaisRelatorio.valorFiscal)}</td><td>{formatarMoeda(relatorio.totaisRelatorio.complemento)}</td><td>{formatarMoeda(relatorio.totaisRelatorio.valorFisico)}</td><td></td></tr>} />
        ) : (
          <Tabela titulo="Viagens (ordenadas por NF crescente)" colunas={["NF", "Data de entrega", "Caminhão", "CT-e", "Volume entregue", "Taxa", "Valor"]} itens={dadosExibidos.viagens} linha={(v) => <>
            <td>{v.nf || "—"}</td><td>{formatarData(v.dataEntrega)}</td><td>{identificacaoCaminhao(v)}</td><td>{v.cte || "—"}</td><td>{formatarNumero(v.volumeEntregue)}</td><td>{formatarMoeda(v.taxa)}</td><td>{formatarMoeda(v.valorEntregue)}</td>
          </>} />
        )}
        <Tabela titulo="Abastecimentos" colunas={["Data", "Caminhão", "Posto", "KM", "Diesel (L)", "ARLA (L)", "Total"]} itens={dadosExibidos.abastecimentos} linha={(v) => <>
          <td>{formatarData(v.data)}</td><td>{identificacaoCaminhao(v)}</td><td>{v.posto || "—"}</td><td>{v.km ?? "—"}</td><td>{v.litrosDiesel ?? "—"}</td><td>{v.litrosArla ?? "—"}</td><td>{formatarMoeda(v.valorTotal)}</td>
        </>} />
        <Tabela titulo="Despesas dos caminhões" colunas={["Data", "Caminhão", "Descrição", "Valor"]} itens={dadosExibidos.despesasCaminhao} linha={(v) => <>
          <td>{formatarData(v.data)}</td><td>{identificacaoCaminhao(v)}</td><td>{v.descricao || "—"}</td><td>{formatarMoeda(v.valor)}</td>
        </>} />
        <Tabela titulo="Despesas gerais" colunas={["Data", "Descrição", "Valor"]} itens={dadosExibidos.despesasGerais} linha={(v) => <>
          <td>{formatarData(v.data)}</td><td>{v.descricao || "—"}</td><td>{formatarMoeda(v.valor)}</td>
        </>} />
        <Tabela titulo="ICMS" colunas={["Data", "Caminhão", "CT-e", "Valor"]} itens={dadosExibidos.icms} linha={(v) => <>
          <td>{formatarData(v.data)}</td><td>{identificacaoCaminhao(v)}</td><td>{v.cte || "—"}</td><td>{formatarMoeda(v.valor)}</td>
        </>} />
      </>}
    </div>
  );
}

function Resumo({ titulo, valor }) {
  return <article className="consulta-resumo-card"><span>{titulo}</span><strong>{valor}</strong></article>;
}

export default ConsultaPeriodo;
