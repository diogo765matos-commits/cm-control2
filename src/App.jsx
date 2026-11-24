import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import logo from "./assets/logo.png";

import Dashboard from "./pages/Dashboard";
import Frota from "./pages/Frota";
import Caminhao from "./pages/Caminhao";
import { DespesasV2, FormularioDespesaV2 } from "./v2/DespesasV2";
import { LancamentosV2, FormularioViagemV2 } from "./v2/LancamentosV2";
import { AlocacoesV2, PerfilMotoristaV2, TaxasV2 } from "./v2/FrotaV2";
import PeriodoDetalhe from "./pages/PeriodoDetalhe";
import ConsultaPeriodo from "./pages/ConsultaPeriodo";

import { auth } from "./lib/supabase";
import "./styles/responsive.css";
import "./styles/v2.css";
import "./styles/interface.css";

function App() {
  const [sessao, setSessao] = useState(() => auth.sessaoAtual());
  const [menuAberto, setMenuAberto] = useState(() => !window.matchMedia("(max-width: 900px)").matches);
  const fecharMenu = useCallback(() => setMenuAberto(false), []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    media.addEventListener("change", fecharMenu);
    return () => media.removeEventListener("change", fecharMenu);
  }, [fecharMenu]);

  if (!sessao) {
    return <Login onLogin={() => setSessao(auth.sessaoAtual())} />;
  }

  function sair() {
    auth.logout();
    setSessao(null);
  }

  return (
    <BrowserRouter>
      <div className="app v2-shell">
        <header className="topo-mobile">
          <div className="topo-mobile-marca">
            <img src={logo} alt="C&M Control" />
            <span>C&amp;M Control</span>
          </div>

          <button
            className="botao-hamburguer"
            onClick={() => setMenuAberto(v => !v)}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuAberto}
            aria-controls="menu-principal"
          >
            ☰
          </button>
        </header>

        <Sidebar
          onSair={sair}
          email={sessao?.user?.email}
          aberto={menuAberto}
          onFechar={fecharMenu}
        />

        <div
          className={
            menuAberto ? "sidebar-backdrop visivel" : "sidebar-backdrop"
          }
          onClick={fecharMenu}
        />

        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/frota" element={<Frota />} />
            <Route path="/caminhao/:id" element={<Caminhao />} />
            <Route path="/frota/motorista/:id" element={<PerfilMotoristaV2 />} />
            <Route path="/frota/taxas" element={<TaxasV2 />} />
            <Route path="/alocacoes" element={<AlocacoesV2 />} />
            <Route path="/lancamentos" element={<LancamentosV2 />} />
            <Route path="/lancamentos/viagem" element={<FormularioViagemV2 />} />
            <Route path="/lancamentos/despesa" element={<FormularioDespesaV2 />} />
            <Route path="/despesas" element={<DespesasV2 />} />
            <Route path="/despesas-extras" element={<Navigate to="/despesas" replace />} />
            <Route path="/consulta-periodo" element={<ConsultaPeriodo />} />
            <Route path="/periodo/:inicio/:fim" element={<PeriodoDetalhe />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;

