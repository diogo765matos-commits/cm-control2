import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/frota.css";

function Frota() {
  const navigate = useNavigate();

const [caminhoes, setCaminhoes] = useState(() => {
  const caminhoesSalvos = localStorage.getItem("caminhoes");

  if (caminhoesSalvos) {
    return JSON.parse(caminhoesSalvos);
  }

  return [
    {
      id: 1,
      modelo: "Volvo FH 540",
      placa: "ABC1D23",
      motorista: "João Silva",
    },
    {
      id: 2,
      modelo: "Scania R450",
      placa: "XYZ4F85",
      motorista: "Pedro Santos",
    },
  ];
});
useEffect(() => {
  localStorage.setItem("caminhoes", JSON.stringify(caminhoes));
}, [caminhoes]);
const [mostrarFormulario, setMostrarFormulario] = useState(false);

const [novoCaminhao, setNovoCaminhao] = useState({
  modelo: "",
  placa: "",
  motorista: "",
});
function adicionarCaminhao() {
  if (
    !novoCaminhao.modelo.trim() ||
    !novoCaminhao.placa.trim() ||
    !novoCaminhao.motorista.trim()
  ) {
    alert("Preencha todos os campos.");
    return;
  }

  const caminhao = {
    id: Date.now(),
    modelo: novoCaminhao.modelo,
    placa: novoCaminhao.placa.toUpperCase(),
    motorista: novoCaminhao.motorista,
  };

  setCaminhoes([...caminhoes, caminhao]);

  setNovoCaminhao({
    modelo: "",
    placa: "",
    motorista: "",
  });

  setMostrarFormulario(false);
}
function excluirCaminhao(id) {
  const confirmar = window.confirm(
    "Tem certeza que deseja excluir este caminhão?"
  );

  if (!confirmar) {
    return;
  }

  setCaminhoes((caminhoesAtuais) =>
    caminhoesAtuais.filter((caminhao) => caminhao.id !== id)
  );
}
  return (
    <>
      <div className="topo">
        <h1>Frota</h1>

        <button
  className="novo"
  onClick={() => setMostrarFormulario(true)}
>
  + Novo Caminhão
</button>
      </div>
{mostrarFormulario && (
  <div className="form-novo-caminhao">
    <h2>Novo Caminhão</h2>

    <input
      type="text"
      placeholder="Modelo do caminhão"
      value={novoCaminhao.modelo}
      onChange={(e) =>
        setNovoCaminhao({
          ...novoCaminhao,
          modelo: e.target.value,
        })
      }
    />

    <input
      type="text"
      placeholder="Placa"
      value={novoCaminhao.placa}
      onChange={(e) =>
        setNovoCaminhao({
          ...novoCaminhao,
          placa: e.target.value,
        })
      }
    />

    <input
      type="text"
      placeholder="Motorista"
      value={novoCaminhao.motorista}
      onChange={(e) =>
        setNovoCaminhao({
          ...novoCaminhao,
          motorista: e.target.value,
        })
      }
    />
    <button
  type="button"
  onClick={adicionarCaminhao}
>
  Salvar Caminhão
</button>
  </div>
)}
      <div className="grid">
        {caminhoes.map((caminhao) => (
          <div className="cardCaminhao" key={caminhao.id}>
            <h2>🚛 {caminhao.modelo}</h2>

            <p>
              <strong>Placa: </strong>
              {caminhao.placa}
            </p>

            <p>
              <strong>Motorista: </strong>
              {caminhao.motorista}
            </p>

            <button
              onClick={() =>
                navigate(`/caminhao/${caminhao.placa}`)
              }
            >
              Abrir →
            </button>
            <button
  onClick={() => excluirCaminhao(caminhao.id)}
  style={{
    background: "#dc3545",
    color: "white",
    border: "none",
    padding: "10px 16px",
    borderRadius: "6px",
    cursor: "pointer",
    marginLeft: "10px",
  }}
>
  🗑 Excluir Caminhão
</button>
          </div>
        ))}
      </div>
    </>
  );
}

export default Frota;