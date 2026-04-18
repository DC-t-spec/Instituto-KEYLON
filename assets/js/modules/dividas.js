import { supabase } from "../config/supabase.js";

const els = {};

function getEls() {
  els.totalDebt = document.getElementById("total-debt");
  els.totalPaid = document.getElementById("total-paid");
  els.totalDebtors = document.getElementById("total-debtors");
  els.totalOverdue = document.getElementById("total-overdue");
  els.search = document.getElementById("search");
  els.tableBody = document.getElementById("dividas-table-body");
}

function money(value) {
  return new Intl.NumberFormat("pt-MZ", {
    style: "currency",
    currency: "MZN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function normalizeStatus(item) {
  const debtValue = Number(item.debt || item.total_debt || 0);
  if (debtValue <= 0) return "Sem dívida";
  if (item.is_overdue) return "Atrasado";
  return "Pendente";
}

function renderStats(rows) {
  if (!els.totalDebt || !els.totalPaid || !els.totalDebtors || !els.totalOverdue) return;

 const totalDebt = rows.reduce((sum, row) => sum + Number(row.debt || row.total_debt || 0), 0);
const totalPaid = rows.reduce((sum, row) => sum + Number(row.total_paid || row.paid || 0), 0);
const totalDebtors = rows.filter((row) => Number(row.debt || row.total_debt || 0) > 0).length;
const totalOverdue = rows.filter((row) => row.is_overdue && Number(row.debt || row.total_debt || 0) > 0).length;

  els.totalDebt.textContent = money(totalDebt);
  els.totalPaid.textContent = money(totalPaid);
  els.totalDebtors.textContent = totalDebtors;
  els.totalOverdue.textContent = totalOverdue;
}

function renderTable(rows) {
  if (!els.tableBody) return;

  if (!rows.length) {
    els.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Sem dívidas encontradas.</td>
      </tr>
    `;
    return;
  }

  els.tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
        <td>${row.student_name || row.student || "-"}</td>
<td>${row.course_name || row.course || "-"}</td>
<td>${row.class_name || row.class || "-"}</td>
<td>${money(row.total_charged || row.charged || 0)}</td>
<td>${money(row.total_paid || row.paid || 0)}</td>
<td>${money(row.debt || row.total_debt || 0)}</td>
<td>${normalizeStatus(row)}</td>
        </tr>
      `
    )
    .join("");
}

function applySearch(rows) {
  const term = (els.search?.value || "").trim().toLowerCase();
  if (!term) return rows;

  return rows.filter((row) => {
    const student = (row.student_name || "").toLowerCase();
    const course = (row.course_name || "").toLowerCase();
    const turma = (row.class_name || "").toLowerCase();
    return student.includes(term) || course.includes(term) || turma.includes(term);
  });
}

async function loadDividas() {
  if (!els.tableBody) return;

  els.tableBody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-cell">A carregar dívidas...</td>
    </tr>
  `;

const { data, error } = await supabase
  .from("v_student_debts")
  .select("*");
  console.log("DIVIDAS DATA:", data);

  if (error) {
    console.error("Erro ao carregar dívidas:", error);
    els.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Erro ao carregar dívidas.</td>
      </tr>
    `;
    return;
  }

  const filtered = applySearch(data || []);
  renderStats(filtered);
  renderTable(filtered);
}

export async function initDividas() {
  getEls();

  if (!els.tableBody) {
    console.error("Elemento #dividas-table-body não encontrado.");
    return;
  }

  if (els.search) {
    els.search.addEventListener("input", () => {
      loadDividas();
    });
  }

  await loadDividas();
}
