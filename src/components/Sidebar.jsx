import { NavLink } from "react-router-dom";
import logo from "../assets/logo.png";
import "../styles/sidebar.css";

function Sidebar({ onSair }) {
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
          to="/despesas-extras"
          className={({ isActive }) =>
            isActive ? "menu-link active" : "menu-link"
          }
        >
          🧾 Despesas Extras
        </NavLink>

      </nav>

      {onSair && (
        <button
          onClick={onSair}
          className="menu-link"
          style={{
            marginTop: "auto",
            width: "100%",
            border: "none",
            background: "transparent",
            textAlign: "left",
            cursor: "pointer",
            fontSize: "inherit",
            fontFamily: "inherit",
          }}
        >
          🚪 Sair
        </button>
      )}
    </aside>
  );
}

export default Sidebar;