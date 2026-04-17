import { supabase } from "../../core/config.js";

export async function renderDebtsPage() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <div class="page">
      <h1>📊 Dívidas</h1>

      <div class="filters">
        <select id="filterStatus">
          <option value="">Todos</option>
          <option value="overdue">Atrasados</option>
          <option value="pending">Pendentes</option>
          <option value="paid">Pagos</option>
        </select>

        <input type="text" id="search" placeholder="Buscar aluno..." />
      </div>

      <div id="debtsTable"></div>
    </div>
  `;

  loadDebts();
}
