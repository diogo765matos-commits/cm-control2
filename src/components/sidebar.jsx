import { NavLink } from "react-router-dom";
import logo from "../assets/logo.png";
import "../styles/sidebar.css";

function Sidebar() {
  return (
    <aside className="sidebar">
      <img src={logo} alt="C&M Control" className="logo" />

      <h2>C&M Control</h2>

      <nav className="menu">

        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? "menu-link active" : "menu-link"
          }
        >
          🏠 Painel
        </NavLink>

        <NavLink
          to="/frota"
          className={({ isActive }) =>
            isActive ? "menu-link active" : "menu-link"
          }
        >
          🚛 Frota
        </NavLink>

        <NavLink
          to="/fechamento"
          className={({ isActive }) =>
            isActive ? "menu-link active" : "menu-link"
          }
        >
          📅 Fechamento
        </NavLink>

        <NavLink
          to="/relatorios"
          className={({ isActive }) =>
            isActive ? "menu-link active" : "menu-link"
          }
        >
          📊 Relatórios
        </NavLink>

      </nav>
    </aside>
  );
}

export default Sidebar;