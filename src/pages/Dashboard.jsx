import { getCaminhoes } from "../data/caminhoes";
import { VALOR_POR_VOLUME, PERCENTUAL_MOTORISTA } from "../data/config";
import { converterNumero, formatarMoeda } from "../utils/formatadores";

function carregarLista(chave, valorPadrao = []) {
  const salvo = localStorage.getItem(chave);
  return salvo ? JSON.parse(salvo) : valorPadrao;
}

function calcularResumoGeral() {
  const caminhoes = getCaminhoes();

  let totalViagens = 0;
  let volumeTotalEntregue = 0;
  let totalCombustivel = 0;
  let totalDespesasExtras = 0;

  caminhoes.forEach((caminhao) => {
    const semanasViagens = carregarLista(
      `viagens-semanas-${caminhao.placa}`
    );

    semanasViagens.forEach((semana) => {
      totalViagens += semana.viagens.length;

      semana.viagens.forEach((viagem) => {
        volumeTotalEntregue += converterNumero(viagem.volEntregue) || 0;
      });
    });

    const semanasAbastecimento = carregarLista(
      `abastecimentos-semanas-${caminhao.placa}`
    );

    semanasAbastecimento.forEach((semana) => {
      semana.abastecimentos.forEach((abastecimento) => {
        totalCombustivel += abastecimento.valorTotal || 0;
      });
    });

    const semanasDespesas = carregarLista(
      `semanas-despesas-${caminhao.placa}`
    );

    semanasDespesas.forEach((semana) => {
      semana.despesas.forEach((despesa) => {
        totalDespesasExtras += Number(despesa.valor) || 0;
      });
    });
  });

  const receitaBruta = volumeTotalEntregue * VALOR_POR_VOLUME;
  const pagamentoMotoristas = receitaBruta * PERCENTUAL_MOTORISTA;
  const gastos = totalCombustivel + totalDespesasExtras + pagamentoMotoristas;
  const lucro = receitaBruta - gastos;

  return {
    receitaBruta,
    gastos,
    lucro,
    totalViagens,
    totalCaminhoes: caminhoes.length,
  };
}

function Dashboard() {
  const resumo = calcularResumoGeral();

  return (
    <>
      <h1>Painel</h1>

      <div className="cards">
        <div className="card">
          <h3>Receita Bruta</h3>
          <h2>{formatarMoeda(resumo.receitaBruta)}</h2>
        </div>

        <div className="card">
          <h3>Gastos (combustível + despesas + motoristas)</h3>
          <h2>{formatarMoeda(resumo.gastos)}</h2>
        </div>

        <div className="card">
          <h3>Lucro da Empresa</h3>
          <h2>{formatarMoeda(resumo.lucro)}</h2>
        </div>

        <div className="card">
          <h3>Viagens</h3>
          <h2>{resumo.totalViagens}</h2>
        </div>
      </div>

      <p style={{ color: "#777", marginTop: "30px" }}>
        {resumo.totalCaminhoes} caminhão(ões) cadastrado(s). Valores somam
        todas as semanas lançadas em todos os caminhões — veja o detalhamento
        por semana em "Fechamento".
      </p>
    </>
  );
}

export default Dashboard;
