import { supabase } from "../config/supabase.js";

const els = {};
let allRows = [];

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

function normalizeNumber(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeStatus(row) {
  const debt = normalizeNumber(row.total_debt);
  const overdueCount = normalizeNumber(row.overdue_count);

  if (debt <= 0) return "Sem dívida";
  if (overdueCount > 0) return "Atrasado";
  return "Pendente";
}

function renderStats(rows) {
  if (!els.totalDebt || !els.totalPaid || !els.totalDebtors || !els.totalOverdue) return;

  const totalDebt = rows.reduce((sum, row) => sum + normalizeNumber(row.total_debt), 0);
  const totalPaid = rows.reduce((sum, row) => sum + normalizeNumber(row.total_paid), 0);
  const totalDebtors = rows.filter((row) => normalizeNumber(row.total_debt) > 0).length;
  const totalOverdue = rows.filter((row) => normalizeNumber(row.overdue_count) > 0).length;

  console.log("[finance-debug] totals", { totalDebt, totalPaid });

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
          <td>${row.full_name || "-"}</td>
          <td>${row.course_name || "-"}</td>
          <td>${row.class_name || "-"}</td>
          <td>${money(row.total_charged)}</td>
          <td>${money(row.total_paid)}</td>
          <td>${money(row.total_debt)}</td>
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
    const student = (row.full_name || "").toLowerCase();
    const course = (row.course_name || "").toLowerCase();
    const turma = (row.class_name || "").toLowerCase();
    return student.includes(term) || course.includes(term) || turma.includes(term);
  });
}

function renderFilteredRows() {
  const filtered = applySearch(allRows);
  renderStats(filtered);
  renderTable(filtered);
}

function expectedAmount(charge) {
  return normalizeNumber(charge?.final_amount ?? charge?.amount);
}

async function loadDividas() {
  if (!els.tableBody) return;

  els.tableBody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-cell">A carregar dívidas...</td>
    </tr>
  `;

  const [studentsResult, chargesResult, paymentsResult] = await Promise.all([
    supabase.from("students").select(`
      id,
      full_name,
      classes (
        id,
        name,
        courses (
          id,
          name
        )
      )
    `),
    supabase.from("student_charges").select("id, student_id, due_date, amount, final_amount"),
    supabase.from("payments").select("id, charge_id, amount")
  ]);

  const firstError = [studentsResult, chargesResult, paymentsResult].find((result) => result.error)?.error;
  if (firstError) {
    console.error("Erro ao carregar dívidas:", firstError);
    els.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Erro ao carregar dívidas.</td>
      </tr>
    `;
    return;
  }

  const students = studentsResult.data || [];
  const charges = chargesResult.data || [];
  const payments = paymentsResult.data || [];

  console.log("[finance-debug] charges", charges);
  console.log("[finance-debug] payments", payments);

  const paymentTotalsByChargeId = payments.reduce((acc, payment) => {
    const chargeId = payment?.charge_id;
    if (!chargeId) return acc;
    acc[chargeId] = normalizeNumber(acc[chargeId]) + normalizeNumber(payment.amount);
    return acc;
  }, {});

  const today = new Date().toISOString().split("T")[0];

  const aggregatesByStudentId = charges.reduce((acc, charge) => {
    const studentId = charge?.student_id;
    if (!studentId || !charge?.id) return acc;

    if (!acc[studentId]) {
      acc[studentId] = {
        total_charged: 0,
        total_paid: 0,
        total_debt: 0,
        overdue_count: 0
      };
    }

    const expected = expectedAmount(charge);
    const paid = normalizeNumber(paymentTotalsByChargeId[charge.id]);
    const debt = expected - paid;

    acc[studentId].total_charged += expected;
    acc[studentId].total_paid += paid;
    acc[studentId].total_debt += debt;

    if (charge.due_date && charge.due_date < today && debt > 0) {
      acc[studentId].overdue_count += 1;
    }

    return acc;
  }, {});

  allRows = students
    .map((student) => {
      const aggregate = aggregatesByStudentId[student.id] || {
        total_charged: 0,
        total_paid: 0,
        total_debt: 0,
        overdue_count: 0
      };

      return {
        full_name: student.full_name || "-",
        course_name: student.classes?.courses?.name || "-",
        class_name: student.classes?.name || "-",
        total_charged: normalizeNumber(aggregate.total_charged),
        total_paid: normalizeNumber(aggregate.total_paid),
        total_debt: normalizeNumber(aggregate.total_debt),
        overdue_count: normalizeNumber(aggregate.overdue_count)
      };
    })
    .sort((a, b) => b.total_debt - a.total_debt);

  renderFilteredRows();
}

export async function initDividas() {
  getEls();

  if (!els.tableBody) {
    console.error("Elemento #dividas-table-body não encontrado.");
    return;
  }

  if (els.search) {
    els.search.addEventListener("input", renderFilteredRows);
  }

  await loadDividas();
}
