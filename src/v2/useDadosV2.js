import { useEffect, useState } from 'react';
import { carregarMotoristas, carregarAlocacoes, carregarTaxas } from './api';
import { getCaminhoes } from '../data/caminhoes';

export function useDadosV2({comTaxas = false, comCaminhoes = true} = {}) {
  const [versao, setVersao] = useState(0);
  const [estado, setEstado] = useState({ carregando:true, erro:'', motoristas:[], caminhoes:[], alocacoes:[], taxas:[] });
  useEffect(() => {
    let ativo = true;
    Promise.all([carregarMotoristas(), carregarAlocacoes(), comCaminhoes ? getCaminhoes() : [], comTaxas ? carregarTaxas() : []])
      .then(([motoristas, alocacoes, caminhoes, taxas]) => {
        if (ativo) setEstado({ carregando:false, erro:'', motoristas, alocacoes, caminhoes, taxas });
      })
      .catch(erro => {
        if (ativo) setEstado(atual => ({ ...atual, carregando:false, erro:erro.message }));
      });
    return () => { ativo = false; };
  }, [versao, comTaxas, comCaminhoes]);
  return { ...estado, atualizar:() => setVersao(v => v + 1) };
}
