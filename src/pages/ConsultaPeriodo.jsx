import { useState } from "react";
import { formatarData, formatarMoeda, formatarNumero } from "../utils/formatadores";
import { consultarLancamentosPorPeriodo } from "../data/consultaPeriodo";
import PageHeader from "../components/PageHeader";
import "../styles/consultaPeriodo.css";

function identificacaoCaminhao(item) {
  if (!item.caminhao) return "Despesas gerais";
  return `${item.caminhao.modelo || "Caminhão"} (${item.caminhao.placa || "sem placa"})`;
}

async function exportarExcel(consulta) {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) throw new Error("O gerador ExcelJS não está disponível. Recarregue a página e tente novamente.");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "C&M Control";
  workbook.created = new Date();
  const periodo = `${formatarData(consulta.inicio)} a ${formatarData(consulta.fim)}`;
  const folhas = [
    {
      nome: "Viagens",
      itens: consulta.viagens,
      colunas: ["NF", "CT-e", "Data entrega", "Caminhão", "Frota", "Volume fiscal", "Volume entregue", "Taxa", "Valor fiscal", "Valor entregue"],
      linha: (v) => [v.nf || "", v.cte || "", formatarData(v.dataEntrega), identificacaoCaminhao(v), v.caminhao?.frota || "", v.volumeFiscal, v.volumeEntregue, v.taxa, v.valorFiscal, v.valorEntregue],
    },
    {
      nome: "Abastecimentos",
      itens: consulta.abastecimentos,
      colunas: ["Data", "Caminhão", "Posto", "KM", "Litros diesel", "Litros ARLA", "Valor total"],
      linha: (v) => [formatarData(v.data), identificacaoCaminhao(v), v.posto || "", v.km ?? "", v.litrosDiesel ?? "", v.litrosArla ?? "", Number(v.valorTotal) || 0],
    },
    {
      nome: "Despesas caminhão",
      itens: consulta.despesasCaminhao,
      colunas: ["Data", "Caminhão", "Descrição", "Valor"],
      linha: (v) => [formatarData(v.data), identificacaoCaminhao(v), v.descricao || "", Number(v.valor) || 0],
    },
    {
      nome: "Despesas gerais",
      itens: consulta.despesasGerais,
      colunas: ["Data", "Descrição", "Valor"],
      linha: (v) => [formatarData(v.data), v.descricao || "", Number(v.valor) || 0],
    },
    {
      nome: "ICMS",
      itens: consulta.icms,
      colunas: ["Data", "Caminhão", "CT-e", "Valor"],
      linha: (v) => [formatarData(v.data), identificacaoCaminhao(v), v.cte || "", Number(v.valor) || 0],
    },
  ];

  for (const folha of folhas) {
    const sheet = workbook.addWorksheet(folha.nome);
    sheet.addRow(["C&M CONTROL — CONSULTA POR PERÍODO", periodo]);
    sheet.addRow(folha.colunas);
    folha.itens.forEach((item) => sheet.addRow(folha.linha(item)));
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
  link.download = `Consulta_${consulta.inicio}_a_${consulta.fim}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Tabela({ titulo, colunas, itens, linha }) {
  return (
    <section className="consulta-card">
      <h2>{titulo} <span className="consulta-contagem">{itens.length}</span></h2>
      {!itens.length ? <p className="consulta-vazio">Nenhum lançamento no intervalo.</p> : (
        <div className="consulta-tabela-scroll">
          <table className="consulta-tabela">
            <thead><tr>{colunas.map((coluna) => <th key={coluna}>{coluna}</th>)}</tr></thead>
            <tbody>{itens.map((item, indice) => <tr key={`${item.tipo}-${item.caminhaoId || "geral"}-${item.id ?? indice}`}>{linha(item)}</tr>)}</tbody>
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
    try { await exportarExcel(consulta); }
    catch (e) { setErro(e.message); }
  }

  return (
    <div className="consulta-periodo">
      <PageHeader titulo="Consulta por Período" subtitulo="Consulte lançamentos pela data em que ocorreram, sem depender do fechamento semanal." />
      <form className="consulta-filtros sem-impressao" onSubmit={consultar}>
        <label>Data inicial<input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></label>
        <label>Data final<input type="date" value={fim} onChange={(e) => setFim(e.target.value)} min={inicio || undefined} required /></label>
        <button type="submit" disabled={carregando}>{carregando ? "Consultando…" : "Consultar"}</button>
      </form>
      {erro && <p className="consulta-erro" role="alert">{erro}</p>}
      {consulta && <>
        <div className="consulta-periodo-titulo">
          <h2>Resultados de {formatarData(consulta.inicio)} a {formatarData(consulta.fim)}</h2>
          <div className="consulta-acoes sem-impressao">
            <button type="button" onClick={baixarExcel}>Exportar Excel</button>
            <button type="button" className="consulta-botao-secundario" onClick={() => window.print()}>Salvar como PDF</button>
          </div>
        </div>
        <section className="consulta-resumo" aria-label="Resumo do intervalo">
          <Resumo titulo="Viagens" valor={consulta.totais.quantidadeViagens} />
          <Resumo titulo="Volume entregue" valor={formatarNumero(consulta.totais.volumeEntregue)} />
          <Resumo titulo="Receita bruta" valor={formatarMoeda(consulta.totais.receitaBruta)} />
          <Resumo titulo="Combustível" valor={formatarMoeda(consulta.totais.combustivel)} />
          <Resumo titulo="Despesas dos caminhões" valor={formatarMoeda(consulta.totais.despesasCaminhao)} />
          <Resumo titulo="Despesas gerais" valor={formatarMoeda(consulta.totais.despesasGerais)} />
          <Resumo titulo="ICMS lançado" valor={formatarMoeda(consulta.totais.icms)} />
        </section>
        <Tabela titulo="Viagens (ordenadas por NF crescente)" colunas={["NF", "Data de entrega", "Caminhão", "CT-e", "Volume entregue", "Taxa", "Valor"]} itens={consulta.viagens} linha={(v) => <>
          <td>{v.nf || "—"}</td><td>{formatarData(v.dataEntrega)}</td><td>{identificacaoCaminhao(v)}</td><td>{v.cte || "—"}</td><td>{formatarNumero(v.volumeEntregue)}</td><td>{formatarMoeda(v.taxa)}</td><td>{formatarMoeda(v.valorEntregue)}</td>
        </>} />
        <Tabela titulo="Abastecimentos" colunas={["Data", "Caminhão", "Posto", "KM", "Diesel (L)", "ARLA (L)", "Total"]} itens={consulta.abastecimentos} linha={(v) => <>
          <td>{formatarData(v.data)}</td><td>{identificacaoCaminhao(v)}</td><td>{v.posto || "—"}</td><td>{v.km ?? "—"}</td><td>{v.litrosDiesel ?? "—"}</td><td>{v.litrosArla ?? "—"}</td><td>{formatarMoeda(v.valorTotal)}</td>
        </>} />
        <Tabela titulo="Despesas dos caminhões" colunas={["Data", "Caminhão", "Descrição", "Valor"]} itens={consulta.despesasCaminhao} linha={(v) => <>
          <td>{formatarData(v.data)}</td><td>{identificacaoCaminhao(v)}</td><td>{v.descricao || "—"}</td><td>{formatarMoeda(v.valor)}</td>
        </>} />
        <Tabela titulo="Despesas gerais" colunas={["Data", "Descrição", "Valor"]} itens={consulta.despesasGerais} linha={(v) => <>
          <td>{formatarData(v.data)}</td><td>{v.descricao || "—"}</td><td>{formatarMoeda(v.valor)}</td>
        </>} />
        <Tabela titulo="ICMS" colunas={["Data", "Caminhão", "CT-e", "Valor"]} itens={consulta.icms} linha={(v) => <>
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
