import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";

import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import logo from "./assets/logo.png";

import Dashboard from "./pages/Dashboard";
import Frota from "./pages/Frota";
import Caminhao from "./pages/Caminhao";
import DespesasExtras from "./pages/Relatorios";

import { auth } from "./lib/supabase";

function App() {
  const [sessao, setSessao] = useState(() => auth.sessaoAtual());
  const [menuAberto, setMenuAberto] = useState(false);

  if (!sessao) {
    return <Login onLogin={() => setSessao(auth.sessaoAtual())} />;
  }

  function sair() {
    auth.logout();
    setSessao(null);
  }

  return (
    <BrowserRouter>
      <div className="app">
        <div className="topo-mobile">
          <div className="topo-mobile-marca">
            <img src={logo} alt="C&M Control" />
            <span>C&amp;M Control</span>
          </div>

          <button
            className="botao-hamburguer"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
          >
            ☰
          </button>
        </div>

        <Sidebar
          onSair={sair}
          email={sessao?.user?.email}
          aberto={menuAberto}
          onFechar={() => setMenuAberto(false)}
        />

        <div
          className={
            menuAberto ? "sidebar-backdrop visivel" : "sidebar-backdrop"
          }
          onClick={() => setMenuAberto(false)}
        />

        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/frota" element={<Frota />} />
            <Route path="/caminhao/:placa" element={<Caminhao />} />
            <Route path="/despesas-extras" element={<DespesasExtras />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
