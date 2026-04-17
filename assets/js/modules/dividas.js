import { supabase } from "../config/supabase.js";

const tableBodyId = "dividas-table-body";
const searchId = "search-dividas";
const statusFilterId = "filter-status";

let dividasData = [];

export async function initDividas() {
  await loadDividas();
  setupEvents();
}

async function loadDividas() {
  const { data, error } = await supabase
    .from("v_student_debts")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) {
    console.error("Erro ao carregar dívidas:", error);
    return;
  }

  dividasData = data || [];
  renderDividas(dividasData);
}

function renderDividas(rows) {
  const tbody = document.getElementById(tableBodyId);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-cell">Sem dívidas</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr class="${r.debt_status}">
      <td>${r.student_name}</td>
      <td>${r.course_name || "-"}</td>
      <td>${r.class_name || "-"}</td>
      <td>${format(r.final_amount)}</td>
      <td>${format(r.paid_amount)}</td>
      <td class="text-danger">${format(r.debt_amount)}</td>
      <td>${badge(r.debt_status)}</td>
      <td>${r.due_date || "-"}</td>
    </tr>
  `).join("");
}

function setupEvents() {
  document.getElementById(searchId)?.addEventListener("input", applyFilters);
  document.getElementById(statusFilterId)?.addEventListener("change", applyFilters);
}

function applyFilters() {
  const search = document.getElementById(searchId).value.toLowerCase();
  const status = document.getElementById(statusFilterId).value;

  const filtered = dividasData.filter(r => {
    const matchSearch = r.student_name.toLowerCase().includes(search);
    const matchStatus = !status || r.debt_status === status;
    return matchSearch && matchStatus;
  });

  renderDividas(filtered);
}

function format(v) {
  return Number(v || 0).toLocaleString("pt-MZ") + " MZN";
}

function badge(status) {
  if (status === "paid") return `<span class="badge green">Pago</span>`;
  if (status === "overdue") return `<span class="badge red">Atrasado</span>`;
  return `<span class="badge yellow">Pendente</span>`;
}
