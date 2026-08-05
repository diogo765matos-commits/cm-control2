function Dashboard() {
  return (
    <>
      <h1>Painel</h1>

      <div className="cards">

        <div className="card">
          <h3>Receita da Semana</h3>
          <h2>R$ 0,00</h2>
        </div>

        <div className="card">
          <h3>Gastos</h3>
          <h2>R$ 0,00</h2>
        </div>

        <div className="card">
          <h3>Lucro</h3>
          <h2>R$ 0,00</h2>
        </div>

        <div className="card">
          <h3>Viagens</h3>
          <h2>0</h2>
        </div>

      </div>
    </>
  );
}

export default Dashboard;