import { BrowserRouter, Routes, Route } from "react-router-dom";

import Sidebar from "./components/Sidebar";

import Dashboard from "./pages/Dashboard";
import Frota from "./pages/Frota";
import Caminhao from "./pages/Caminhao";
import Relatorios from "./pages/Relatorios";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Sidebar />

        <div className="content">
          <Routes>
            <Route
              path="/"
              element={<Dashboard />}
            />

            <Route
              path="/frota"
              element={<Frota />}
            />

            <Route
              path="/caminhao/:placa"
              element={<Caminhao />}
            />

            <Route
              path="/relatorios"
              element={<Relatorios />}
            />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;