import { NavLink } from "react-router-dom";
import logo from "../assets/logo.png";
import "../styles/sidebar.css";

const ITENS_MENU = [
  { to: "/", rotulo: "Painel", icone: "🏠" },
  { to: "/frota", rotulo: "Frota", icone: "🚛" },
  { to: "/despesas-extras", rotulo: "Despesas Extras", icone: "🧾" },
];

function Sidebar({ onSair, email }) {
  const inicial = email ? email.trim().charAt(0).toUpperCase() : "?";

  return (
    <aside className="sidebar">
      <div className="sidebar-topo">
        <img src={logo} alt="C&M Control" className="logo" />

        <div className="sidebar-marca">
          <h2>C&amp;M Control</h2>
          <span>Transportadora</span>
        </div>
      </div>

      <nav className="menu">
        {ITENS_MENU.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              isActive ? "menu-link active" : "menu-link"
            }
          >
            <span>{item.icone}</span>
            {item.rotulo}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-rodape">
        {email && (
          <div className="sidebar-usuario">
            <div className="sidebar-usuario-avatar">{inicial}</div>

            <div className="sidebar-usuario-info">
              <strong>Administrador</strong>
              <span title={email}>{email}</span>
            </div>
          </div>
        )}

        {onSair && (
          <button onClick={onSair} className="menu-link">
            <span>🚪</span>
            Sair
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
