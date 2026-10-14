import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import logo from "../assets/logo.png";
import "../styles/sidebar.css";

const ITENS_MENU = [
  { to: "/", rotulo: "Painel", icone: "🏠" },
  { to: "/frota", rotulo: "Frota", icone: "🚛" },
  { to: "/despesas-extras", rotulo: "Despesas Extras", icone: "🧾" },
  { to: "/consulta-periodo", rotulo: "Consulta por Período", icone: "📅" },
];

function Sidebar({ onSair, email, aberto, onFechar }) {
  const sidebarRef = useRef(null);
  const [compacto, setCompacto] = useState(() => window.matchMedia("(max-width: 900px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const atualizar = () => setCompacto(media.matches);
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);

  useEffect(() => {
    if (!aberto || !compacto) return;
    const anterior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector("button")?.focus();
    function teclado(event) {
      if (event.key === "Escape") onFechar();
      if (event.key !== "Tab") return;
      const itens = sidebarRef.current?.querySelectorAll("button, a[href]");
      const primeiro = itens?.[0];
      const ultimo = itens?.[itens.length - 1];
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo?.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro?.focus();
      }
    }
    document.addEventListener("keydown", teclado);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", teclado);
      anterior?.focus();
    };
  }, [aberto, compacto, onFechar]);

  const inicial = email ? email.trim().charAt(0).toUpperCase() : "?";

  return (
    <aside
      id="menu-principal"
      ref={sidebarRef}
      className={aberto ? "sidebar aberta" : "sidebar"}
      inert={compacto && !aberto}
      role={compacto && aberto ? "dialog" : undefined}
      aria-modal={compacto && aberto ? true : undefined}
      aria-label="Menu principal"
    >
      <button
        className="sidebar-fechar"
        onClick={onFechar}
        aria-label="Fechar menu"
      >
        ✕
      </button>

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
            onClick={onFechar}
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

