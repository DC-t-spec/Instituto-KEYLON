import { supabase } from "../config/supabase.js";

const cardsEl = document.getElementById("cards");
const tableBodyEl = document.getElementById("dividas-table-body");
const searchEl = document.getElementById("search");

let rowsData = [];

export async function initDividas() {
  await loadDividas();
  setupEvents();
}

async function loadDividas() {
  const { data, error } = await supabase
    .from("v_student_debt_summary")
    .select("*")
    .order("total_debt", { ascending: false });

  if (error) {
    console.error("Erro ao carregar dívidas:", error);
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">Erro ao carregar dívidas</td>
      </tr>
    `;
    return;
  }

  // só alunos com dívida > 0
  rowsData = (data || []).filter(r => Number(r.total_debt || 0) > 0);

  renderCards(rowsData);
  renderTable(rowsData);
}

function setupEvents() {
  if (!searchEl) return;

  searchEl.addEventListener("input", () => {
    const term = searchEl.value.trim().toLowerCase();

    const filtered = rowsData.filter(row =>
      (row.full_name || "").toLowerCase().includes(term) ||
      (row.course_name || "").toLowerCase().includes(term) ||
      (row.class_name || "").toLowerCase().includes(term)
    );

    renderTable(filtered);
  });
}

function renderCards(rows) {
  const totalDebt = sum(rows, "total_debt");
  const totalPaid = sum(rows, "total_paid");
  const debtors = rows.length;
  const overdue = rows.filter(r => Number(r.overdue_count || 0) > 0).length;

  cardsEl.innerHTML = `
    <div class="stat-card">
      <span class="stat-label">💰 Dívida total</span>
      <strong class="stat-value">${formatMoney(totalDebt)}</strong>
    </div>

    <div class="stat-card">
      <span class="stat-label">✅ Total pago</span>
      <strong class="stat-value">${formatMoney(totalPaid)}</strong>
    </div>

    <div class="stat-card">
      <span class="stat-label">👥 Devedores</span>
      <strong class="stat-value">${debtors}</strong>
    </div>

    <div class="stat-card stat-card-highlight">
      <span class="stat-label">⚠️ Atrasados</span>
      <strong class="stat-value">${overdue}</strong>
    </div>
  `;
}

function renderTable(rows) {
  if (!rows.length) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">Sem dívidas registadas</td>
      </tr>
    `;
    return;
  }

  tableBodyEl.innerHTML = rows.map((row, index) => `
    <tr class="${getRowClass(row, index)}">
      <td>${escapeHtml(row.full_name || "-")}</td>
      <td>${escapeHtml(row.course_name || "-")}</td>
      <td>${escapeHtml(row.class_name || "-")}</td>

      <td>${formatMoney(row.total_charged)}</td>
      <td>${formatMoney(row.total_paid)}</td>

      <td class="text-danger strong">
        ${formatMoney(row.total_debt)}
      </td>

      <td>${renderStatus(row)}</td>

      <td>
        <button class="btn btn-sm btn-primary" onclick="viewCharges('${row.student_id}')">
          Ver
        </button>

        <button class="btn btn-sm btn-success" onclick="quickPay('${row.student_id}')">
          Pagar
        </button>
      </td>
    </tr>
  `).join("");
}

function getRowClass(row, index) {
  // TOP 3 devedores
  if (index === 0) return "row-top-1";
  if (index === 1) return "row-top-2";
  if (index === 2) return "row-top-3";

  // atraso
  if (Number(row.overdue_count || 0) > 0) return "row-overdue";

  return "";
}

function renderStatus(row) {
  if (Number(row.total_debt || 0) <= 0) {
    return `<span class="badge green">Sem dívida</span>`;
  }

  if (Number(row.overdue_count || 0) > 0) {
    return `<span class="badge red">Atrasado</span>`;
  }

  return `<span class="badge yellow">Pendente</span>`;
}

function sum(arr, field) {
  return arr.reduce((a, b) => a + Number(b[field] || 0), 0);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-MZ") + " MZN";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   AÇÕES (integração sistema)
========================= */

window.viewCharges = function(studentId) {
  localStorage.setItem("filter_student_id", studentId);
  window.location.href = "cobrancas.html";
};

window.quickPay = function(studentId) {
  localStorage.setItem("filter_student_id", studentId);
  window.location.href = "cobrancas.html";
};
