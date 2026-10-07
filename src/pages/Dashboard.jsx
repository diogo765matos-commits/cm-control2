import { useEffect, useState } from "react";
import { db } from "../lib/supabase";
import {
  FROTA_BAGACO,
  FROTA_CM,
  FROTA_TERCEIRIZADA,
} from "../data/caminhoes";
import {
  calcularResumoPorPeriodo,
  somarPeriodos,
} from "../utils/resumoPeriodos";
import {
  formatarData,
  formatarMoeda,
  formatarNumero,
} from "../utils/formatadores";
import PageHeader from "../components/PageHeader";
import DateRangeFilter from "../components/DateRangeFilter";
import "../styles/dashboard.css";

const FROTAS_DASHBOARD = [
  { id: FROTA_CM, nome: "C&M", classe: "cm" },
  { id: FROTA_TERCEIRIZADA, nome: "Terceirizada", classe: "terceirizada" },
  { id: FROTA_BAGACO, nome: "Bagaço de Cana", classe: "bagaco" },
];

function rotuloPeriodo(inicio, fim) {
  if (inicio && fim) {
    return `${formatarData(inicio)} a ${formatarData(fim)}`;
  }

  if (inicio) return `A partir de ${formatarData(inicio)}`;
  if (fim) return `Até ${formatarData(fim)}`;
  return "Todos os períodos";
}

function IconeIndicador({ tipo }) {
  const formas = {
    volume: (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12.2V21" />
      </>
    ),
    bruto: (
      <>
        <path d="M12 2.8v18.4M16.5 6.5c-.8-1-2.2-1.5-4.2-1.5-2.5 0-4.1 1.2-4.1 3s1.5 2.7 4.2 3.2c2.7.5 4.2 1.4 4.2 3.2s-1.6 3-4.2 3c-2 0-3.6-.6-4.5-1.8" />
      </>
    ),
    viagens: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7.5" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    motoristas: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {formas[tipo]}
    </svg>
  );
}

function Indicador({ tipo, titulo, valor, detalhe }) {
  return (
    <article className={`dashboard-kpi dashboard-kpi-${tipo}`}>
      <div className="dashboard-kpi-cabecalho">
        <span className="dashboard-kpi-icone">
          <IconeIndicador tipo={tipo} />
        </span>
        <span className="dashboard-kpi-titulo">{titulo}</span>
      </div>
      <strong className="dashboard-kpi-valor">{valor}</strong>
      <span className="dashboard-kpi-detalhe">{detalhe}</span>
    </article>
  );
}

function BarraFrota({ frota, valor, maximo, formatarValor }) {
  const largura =
    maximo > 0 && valor > 0 ? Math.max(2, (valor / maximo) * 100) : 0;

  return (
    <div className="dashboard-barra-linha">
      <span className={`dashboard-frota-nome frota-${frota.classe}`}>
        <span className="dashboard-frota-marcador" aria-hidden="true" />
        {frota.nome}
      </span>
      <div
        className="dashboard-barra-trilho"
        role="img"
        aria-label={`${frota.nome}: ${formatarValor(valor)}`}
      >
        <span
          className={`dashboard-barra-preenchimento frota-${frota.classe}`}
          style={{ width: `${largura}%` }}
        />
      </div>
      <strong className="dashboard-barra-valor">{formatarValor(valor)}</strong>
    </div>
  );
}

function MedidaProducao({ titulo, unidade, valores, formatarValor }) {
  const maximo = Math.max(0, ...valores.map((item) => item.valor));

  return (
    <section className="dashboard-medida">
      <div className="dashboard-medida-cabecalho">
        <h3>{titulo}</h3>
        {unidade && <span className="dashboard-unidade">{unidade}</span>}
      </div>
      <div className="dashboard-barras">
        {valores.map((item) => (
          <BarraFrota
            key={item.frota.id}
            frota={item.frota}
            valor={item.valor}
            maximo={maximo}
            formatarValor={formatarValor}
          />
        ))}
      </div>
    </section>
  );
}

function Dashboard() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [semanasViagens, setSemanasViagens] = useState([]);
  const [semanasAbastecimento, setSemanasAbastecimento] = useState([]);
  const [semanasDespesas, setSemanasDespesas] = useState([]);
  const [frotaPorCaminhao, setFrotaPorCaminhao] = useState(new Map());
  const [filtroInicio, setFiltroInicio] = useState("");
  const [filtroFim, setFiltroFim] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);

      try {
        const [caminhoes, viagens, abastecimentos, despesas] =
          await Promise.all([
            db.select("caminhoes", "select=id,frota"),
            db.select(
              "viagens_semanas",
              "select=inicio,fim,viagens,caminhao_id"
            ),
            db.select(
              "abastecimento_semanas",
              "select=inicio,fim,abastecimentos"
            ),
            db.select("despesas_semanas", "select=inicio,fim,despesas"),
          ]);

        if (!ativo) return;

        setSemanasViagens(viagens);
        setSemanasAbastecimento(abastecimentos);
        setSemanasDespesas(despesas);
        setFrotaPorCaminhao(new Map(caminhoes.map((c) => [c.id, c.frota])));
        setErro("");
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregar();

    return () => {
      ativo = false;
    };
  }, []);

  if (carregando) {
    return <p>Carregando...</p>;
  }

  if (erro) {
    return (
      <p style={{ color: "#dc3545" }}>Erro ao carregar o painel: {erro}</p>
    );
  }

  const opcoesResumo = {
    inicioFiltro: filtroInicio,
    fimFiltro: filtroFim,
    frotaPorCaminhao,
  };
  const periodos = calcularResumoPorPeriodo(
    semanasViagens,
    semanasAbastecimento,
    semanasDespesas,
    opcoesResumo
  );
  const totalGeral = somarPeriodos(periodos);

  const resumoFrota = (frota) => {
    const semanasDaFrota = semanasViagens.filter(
      (semana) => frotaPorCaminhao.get(semana.caminhao_id) === frota
    );

    return somarPeriodos(
      calcularResumoPorPeriodo(semanasDaFrota, [], [], opcoesResumo)
    );
  };
  const dadosFrotas = FROTAS_DASHBOARD.map((frota) => ({
    frota,
    ...resumoFrota(frota.id),
  }));
  const dadosCm = dadosFrotas.find((item) => item.frota.id === FROTA_CM);
  const dadosTerceirizada = dadosFrotas.find(
    (item) => item.frota.id === FROTA_TERCEIRIZADA
  );
  const dadosBagaco = dadosFrotas.find(
    (item) => item.frota.id === FROTA_BAGACO
  );
  const volumeM3 = dadosCm.volumeEntregue + dadosTerceirizada.volumeEntregue;
  const volumeToneladas = dadosBagaco.volumeEntregue;
  const periodoAtual = rotuloPeriodo(filtroInicio, filtroFim);

  const valoresVolume = [dadosCm, dadosTerceirizada].map((item) => ({
    frota: item.frota,
    valor: item.volumeEntregue,
  }));
  const valoresBrutos = dadosFrotas.map((item) => ({
    frota: item.frota,
    valor: item.receitaBruta,
  }));
  const valoresViagens = dadosFrotas.map((item) => ({
    frota: item.frota,
    valor: item.totalViagens,
  }));

  return (
    <main className="dashboard-page">
      <PageHeader titulo="Painel" subtitulo="Produção da empresa">
        <div className="dashboard-periodo-controles">
          <div className="dashboard-periodo-selecionado" aria-live="polite">
            <span>Período selecionado</span>
            <strong>{periodoAtual}</strong>
          </div>
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
        </div>
      </PageHeader>

      <section className="dashboard-kpis" aria-label="Indicadores do período">
        <Indicador
          tipo="volume"
          titulo="Volume entregue"
          valor={`${formatarNumero(volumeM3)} m³`}
          detalhe={
            volumeToneladas > 0
              ? `${formatarNumero(volumeToneladas)} ton. na Frota de Bagaço`
              : "Frota C&M e Terceirizada"
          }
        />
        <Indicador
          tipo="bruto"
          titulo="Valor bruto produzido"
          valor={formatarMoeda(totalGeral.receitaBruta)}
          detalhe="Total bruto do período"
        />
        <Indicador
          tipo="viagens"
          titulo="Viagens realizadas"
          valor={formatarNumero(totalGeral.totalViagens, 0)}
          detalhe="Total do período"
        />
        <Indicador
          tipo="motoristas"
          titulo="Pagamento de motoristas"
          valor={formatarMoeda(totalGeral.pagamentoMotoristas)}
          detalhe="Conforme cálculo financeiro atual"
        />
      </section>

      <section className="dashboard-producao" aria-labelledby="producao-titulo">
        <div className="dashboard-producao-cabecalho">
          <div>
            <p className="dashboard-sobretitulo">Comparativo do período</p>
            <h2 id="producao-titulo">Produção por frota</h2>
          </div>
          <span className="dashboard-periodo-chip">{periodoAtual}</span>
        </div>

        <div className="dashboard-legenda-frotas" aria-label="Frotas">
          {FROTAS_DASHBOARD.map((frota) => (
            <span key={frota.id} className={`frota-${frota.classe}`}>
              <span className="dashboard-frota-marcador" aria-hidden="true" />
              {frota.nome}
            </span>
          ))}
        </div>

        <div className="dashboard-medidas">
          <MedidaProducao
            titulo="Volume entregue"
            unidade="m³"
            valores={valoresVolume}
            formatarValor={(valor) => `${formatarNumero(valor)} m³`}
          />
          <MedidaProducao
            titulo="Valor bruto produzido"
            unidade="R$"
            valores={valoresBrutos}
            formatarValor={formatarMoeda}
          />
          <MedidaProducao
            titulo="Viagens realizadas"
            valores={valoresViagens}
            formatarValor={(valor) => formatarNumero(valor, 0)}
          />
        </div>

        {volumeToneladas > 0 && (
          <div className="dashboard-volume-bagaco">
            <span className="dashboard-frota-marcador frota-bagaco" aria-hidden="true" />
            <strong>Frota de Bagaço de Cana</strong>
            <span>{formatarNumero(volumeToneladas)} ton.</span>
            <small>Volume em toneladas, exibido separado da comparação em m³.</small>
          </div>
        )}
      </section>
    </main>
  );
}

export default Dashboard;
