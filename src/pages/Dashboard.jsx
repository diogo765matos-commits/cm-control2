import { useEffect, useState } from "react";
import { db } from "../lib/supabase";
import { VALOR_POR_VOLUME, PERCENTUAL_MOTORISTA } from "../data/config";
import { converterNumero, formatarMoeda } from "../utils/formatadores";

async function calcularResumoGeral() {
  const [caminhoes, semanasViagens, semanasAbastecimento, semanasDespesas] =
    await Promise.all([
      db.select("caminhoes", "select=id"),
      db.select("viagens_semanas", "select=viagens"),
      db.select("abastecimento_semanas", "select=abastecimentos"),
      db.select("despesas_semanas", "select=despesas"),
    ]);

  let totalViagens = 0;
  let volumeTotalEntregue = 0;
  let totalCombustivel = 0;
  let totalDespesasExtras = 0;

  semanasViagens.forEach((semana) => {
    totalViagens += semana.viagens.length;

    semana.viagens.forEach((viagem) => {
      volumeTotalEntregue += converterNumero(viagem.volEntregue) || 0;
    });
  });

  semanasAbastecimento.forEach((semana) => {
    semana.abastecimentos.forEach((abastecimento) => {
      totalCombustivel += abastecimento.valorTotal || 0;
    });
  });

  semanasDespesas.forEach((semana) => {
    semana.despesas.forEach((despesa) => {
      totalDespesasExtras += Number(despesa.valor) || 0;
    });
  });

  const receitaBruta = volumeTotalEntregue * VALOR_POR_VOLUME;
  const pagamentoMotoristas = receitaBruta * PERCENTUAL_MOTORISTA;
  const gastos =
    totalCombustivel + totalDespesasExtras + pagamentoMotoristas;
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
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    calcularResumoGeral()
      .then((dados) => {
        if (ativo) setResumo(dados);
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      });

    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <p style={{ color: "#dc3545" }}>Erro ao carregar o painel: {erro}</p>
    );
  }

  if (!resumo) {
    return <p>Carregando...</p>;
  }

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
        todas as semanas lançadas em todos os caminhões — veja o
        detalhamento semana a semana na aba "Financeiro" de cada caminhão.
      </p>
    </>
  );
}

export default Dashboard;
