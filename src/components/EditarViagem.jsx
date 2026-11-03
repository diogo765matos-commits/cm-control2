import { useRef, useState } from "react";
import { taxaEfetivaViagem, unidadeDaFrota } from "../data/caminhoes";
import { converterNumero, formatarMoeda } from "../utils/formatadores";

export default function EditarViagem({ viagem, semana, frota, onSave, onCancel, estiloSalvar, estiloCancelar }) {
  const [dados, setDados] = useState({ ...viagem });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const ocupado = useRef(false);
  const unidade = unidadeDaFrota(frota);
  const campos = [
    ["data", "Data", "date"], ["nf", "Nº Nota Fiscal", "text"],
    ["cte", "CTe", "text"], ["volFiscal", `${unidade.rotulo} Fiscal`, "number"],
    ["volEntregue", `${unidade.rotulo} Entregue`, "number"],
    ["dataEntrega", "Data da Entrega", "date"],
    ["taxa", `Valor por ${unidade.rotulo} (R$)`, "number"],
  ];
  async function salvar(event) {
    event.preventDefault();
    if (ocupado.current) return;
    ocupado.current = true;
    setSalvando(true);
    setErro("");
    try { await onSave(semana, viagem, dados); }
    catch (e) { setErro(e.message); }
    finally { ocupado.current = false; setSalvando(false); }
  }
  return <form onSubmit={salvar} className="caminhao-formulario" style={{ padding: 20, border: "1px solid #d4af37", borderRadius: 12, marginBottom: 20 }}>
    <h3>Editar viagem · NF {viagem.nf || "sem número"}</h3>
    <p>A alteração fica nesta semana. Confira o valor antes de salvar.</p>
    <fieldset disabled={salvando} style={{ border: 0, padding: 0 }}>
      <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        {campos.map(([campo, titulo, tipo]) => <label key={campo} style={{ display: "grid", gap: 6 }}>
          {titulo}<input type={tipo} step={tipo === "number" ? "any" : undefined} min={tipo === "number" ? "0" : undefined}
            value={dados[campo] ?? ""} onChange={e => setDados(atual => ({ ...atual, [campo]: e.target.value }))}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
        </label>)}
      </div>
      <p>Valor anterior: <strong>{formatarMoeda(converterNumero(viagem.volEntregue) * taxaEfetivaViagem(viagem, frota))}</strong><br />
      Novo valor: <strong>{formatarMoeda(converterNumero(dados.volEntregue) * taxaEfetivaViagem({ ...dados, taxa: converterNumero(dados.taxa) }, frota))}</strong></p>
      {erro && <p role="alert" style={{ color: "#b42318" }}>{erro}</p>}
      <div className="caminhao-formulario-acoes" style={{ display: "flex", gap: 12 }}>
        <button type="button" style={estiloCancelar} onClick={onCancel}>Cancelar</button>
        <button type="submit" style={estiloSalvar}>{salvando ? "Salvando…" : "Salvar alterações"}</button>
      </div>
    </fieldset>
  </form>;
}
