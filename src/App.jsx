import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";

import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";

import Dashboard from "./pages/Dashboard";
import Frota from "./pages/Frota";
import Caminhao from "./pages/Caminhao";
import DespesasExtras from "./pages/Relatorios";

import { auth } from "./lib/supabase";

function App() {
  const [sessao, setSessao] = useState(() => auth.sessaoAtual());

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
        <Sidebar onSair={sair} />

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
