import { useMemo, useRef, useState } from "react";
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
import { construirWorkbookConsulta } from "../utils/consultaPeriodoExcel";
import logoUrl from "../assets/logo.png";

const comparadorTexto = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

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

async function exportarExcel(relatorio, aindaAtual = () => true) {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) throw new Error("O gerador ExcelJS não está disponível. Recarregue a página e tente novamente.");
  const respostaLogo = await fetch(logoUrl);
  if (!respostaLogo.ok) throw new Error("Não foi possível carregar o logo do relatório. Tente novamente.");
  const logoBlob = await respostaLogo.blob();
  const logoBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível preparar o logo do relatório."));
    reader.readAsDataURL(logoBlob);
  });
  const grupos = agruparCaminhoes(relatorio)
    .sort((a, b) => comparadorTexto.compare(tituloFrota(a.caminhao.frota), tituloFrota(b.caminhao.frota)) || compararCaminhoes(a.caminhao, b.caminhao))
    .map(grupo => ({
      ...grupo,
      nomeFrota: tituloFrota(grupo.caminhao.frota),
      unidade: unidadeVisivel(grupo.caminhao.frota),
      volumeEntregue: grupo.caminhao.frota === FROTA_BAGACO
        ? grupo.totais.toneladasEntregues
        : grupo.caminhao.frota ? grupo.totais.volumeEntregueM3 : grupo.totais.volumeUnidadeDesconhecida,
      registros: { ...grupo.registros, viagens: ordenarPorFrotaECaminhao(grupo.registros.viagens) },
    }));
  const workbook = construirWorkbookConsulta({ ExcelJS, relatorio, grupos, logoBase64 });

  const buffer = await workbook.xlsx.writeBuffer();
  if (!aindaAtual()) return false;
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Relatorio_${relatorio.nomeArquivoEscopo}_${relatorio.inicio}_a_${relatorio.fim}.xlsx`;
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
  const [exportando, setExportando] = useState(false);
  const versaoSelecao = useRef(0);
  const versaoConsulta = useRef(0);
  const [escopo, setEscopo] = useState(ESCOPO_TODOS);
  const [caminhaoSelecionado, setCaminhaoSelecionado] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const consultaAtual = !carregando && consulta?.inicio === inicio && consulta?.fim === fim;
  const dadosEscopo = useMemo(
    () => consultaAtual ? filtrarConsultaPorEscopo(consulta, escopo, caminhaoSelecionado) : null,
    [consulta, consultaAtual, escopo, caminhaoSelecionado]
  );
  const caminhoesDoEscopo = consultaAtual ? consulta.caminhoes : [];
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
          ? `${caminhaoAtual.placa || "Sem placa"} — ${caminhaoAtual.modelo || "Caminhão"} — ${tituloFrota(caminhaoAtual.frota)} (${unidadeVisivel(caminhaoAtual.frota)})${caminhaoAtual.motorista ? ` — ${caminhaoAtual.motorista}` : ""}`
          : "Selecione um caminhão";
  const selecaoValida = consultaAtual && (escopo !== ESCOPO_CAMINHAO || Boolean(caminhaoAtual));
  const relatorio = useMemo(() => {
    if (!dadosEscopo || !selecaoValida) return null;
    const dados = criarDadosRelatorio(dadosEscopo, escopo, rotuloEscopo);
    const nomeArquivoEscopo = escopo === ESCOPO_CAMINHAO
      ? `Caminhao_${caminhaoAtual.placa || "Sem_placa"}_${caminhaoAtual.frota || "Sem_frota"}`
      : escopo === ESCOPO_FROTA_CM ? "Frota_CM" : escopo === ESCOPO_FROTA_TERCEIRIZADA ? "Terceirizada" : "Todos";
    return { ...dados, nomeArquivoEscopo: nomeArquivoEscopo.replace(/[^a-zA-Z0-9_-]/g, "_") };
  }, [dadosEscopo, selecaoValida, escopo, rotuloEscopo, caminhaoAtual]);
  const dadosExibidos = relatorio;
  const gruposCaminhoes = useMemo(() => relatorio ? agruparCaminhoes(relatorio) : [], [relatorio]);

  function mudarPeriodo(campo, valor) {
    versaoSelecao.current += 1;
    versaoConsulta.current += 1;
    setCarregando(false);
    setErro("");
    if (campo === "inicio") setInicio(valor);
    else setFim(valor);
  }

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
    const requisicao = ++versaoConsulta.current;
    versaoSelecao.current += 1;
    setCarregando(true);
    setConsulta(null);
    try {
      const resultado = await consultarLancamentosPorPeriodo(inicio, fim);
      if (requisicao === versaoConsulta.current) setConsulta(resultado);
    } catch (e) {
      if (requisicao === versaoConsulta.current) {
        setErro(`Não foi possível consultar os lançamentos: ${e.message}`);
        setConsulta(null);
      }
    } finally {
      if (requisicao === versaoConsulta.current) setCarregando(false);
    }
  }

  function mudarEscopo(novoEscopo) {
    versaoSelecao.current += 1;
    setErro("");
    setEscopo(novoEscopo);
    setCaminhaoSelecionado("");
  }

  function mudarCaminhao(id) {
    versaoSelecao.current += 1;
    setErro("");
    setCaminhaoSelecionado(id);
  }

  async function baixarExcel() {
    if (!relatorio || exportando) return;
    const versao = versaoSelecao.current;
    setExportando(true);
    setErro("");
    try { await exportarExcel(relatorio, () => versao === versaoSelecao.current); }
    catch (e) { if (versao === versaoSelecao.current) setErro(e.message); }
    finally { setExportando(false); }
  }

  function listaCaminhoes(frota) {
    return gruposCaminhoes.filter((grupo) => grupo.caminhao.frota === frota);
  }

  return (
    <div className="consulta-periodo">
      <PageHeader titulo="Consulta por Período" subtitulo="Consulte lançamentos pela data em que ocorreram, sem depender do fechamento semanal." />
      <form className="consulta-filtros sem-impressao" onSubmit={consultar}>
        <label>Data inicial<input type="date" value={inicio} onChange={(e) => mudarPeriodo("inicio", e.target.value)} required /><span className="consulta-data-legenda">{inicio ? formatarData(inicio) : "DD/MM/AAAA"}</span></label>
        <label>Data final<input type="date" value={fim} onChange={(e) => mudarPeriodo("fim", e.target.value)} min={inicio || undefined} required /><span className="consulta-data-legenda">{fim ? formatarData(fim) : "DD/MM/AAAA"}</span></label>
        <button type="submit" disabled={carregando}>{carregando ? "Consultando…" : "Consultar"}</button>
      </form>
      {erro && <p className="consulta-erro" role="alert">{erro}</p>}
      {consulta && !consultaAtual && !carregando && <p className="consulta-relatorio-legenda" role="status">O período foi alterado. Clique em Consultar para atualizar a prévia e liberar o Excel.</p>}
      {consultaAtual && <section className="consulta-selecao-escopo sem-impressao" aria-label="Controles do relatório">
          <fieldset className="consulta-opcoes-escopo">
            <legend>Qual relatório você quer visualizar e baixar?</legend>
            <div className="consulta-escopo-grid">
              {[
                [ESCOPO_FROTA_CM, "C&M", "Inclui Bagaço de Cana, com unidades separadas"],
                [ESCOPO_FROTA_TERCEIRIZADA, "Terceirizada", "Somente os caminhões terceirizados"],
                [ESCOPO_CAMINHAO, "Caminhão individual", "Escolha qualquer placa e seu contexto de frota"],
                [ESCOPO_TODOS, "Todos", "Consolidado com as despesas gerais da empresa"],
              ].map(([valor, titulo, descricao]) => <label className={escopo === valor ? "consulta-escopo-opcao selecionada" : "consulta-escopo-opcao"} key={valor}>
                <input type="radio" name="escopo-relatorio" value={valor} checked={escopo === valor} onChange={() => mudarEscopo(valor)} />
                <span><strong>{titulo}</strong><small>{descricao}</small></span>
              </label>)}
            </div>
          </fieldset>
          {escopo === ESCOPO_CAMINHAO && <label>Caminhão
            <select value={caminhaoSelecionado} onChange={(e) => mudarCaminhao(e.target.value)}>
              <option value="">Selecione placa, modelo e motorista</option>
              {caminhoesDoEscopo.slice().sort(compararCaminhoes).map((caminhao) => (
                <option key={caminhao.id} value={caminhao.id}>
                  {caminhao.placa || "Sem placa"} — {caminhao.modelo || "Caminhão"} — {tituloFrota(caminhao.frota)} ({unidadeVisivel(caminhao.frota)}){caminhao.motorista ? ` — ${caminhao.motorista}` : ""}
                </option>
              ))}
            </select>
          </label>}
          <div className="consulta-acoes">
            <button type="button" onClick={baixarExcel} disabled={!relatorio || exportando}>{exportando ? "Preparando Excel..." : "Baixar Excel deste relatório"}</button>
            <button type="button" className="consulta-botao-secundario" disabled={!relatorio} onClick={() => window.print()}>Salvar como PDF</button>
          </div>
          <p className="consulta-selecao-ajuda" role="status">{relatorio ? "A prévia abaixo e o Excel usam a mesma seleção. Ao trocar a opção, a prévia é atualizada automaticamente." : "Selecione um caminhão para exibir a prévia e liberar o download."}</p>
        </section>}

      {dadosExibidos && <>
        <div className="consulta-periodo-titulo">
          <div>
            <h2>Prévia do Relatório · {formatarData(dadosExibidos.inicio)} a {formatarData(dadosExibidos.fim)}</h2>
            <p>Escopo: <strong>{dadosExibidos.rotuloEscopo || rotuloEscopo}</strong></p>
          </div>
        </div>
        {relatorio && <p className="consulta-relatorio-legenda">Excel organizado em Resumo e uma aba por caminhão, com os mesmos lançamentos desta prévia.</p>}

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
