import { supabase } from "../config/supabase.js";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "MZN",
    minimumFractionDigits: 2,
  }).format(amount);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderTopDebtors(rows) {
  const tbody = document.getElementById("top-debtors-body");
  if (!tbody) return;

  if (!rows?.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">Sem dados de dívida.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.full_name ?? "-"}</td>
          <td>${row.course_name ?? "-"}</td>
          <td>${row.class_name ?? "-"}</td>
          <td>${formatCurrency(row.total_debt)}</td>
        </tr>
      `
    )
    .join("");
}

function renderOverdue(rows) {
  const tbody = document.getElementById("overdue-body");
  if (!tbody) return;

  if (!rows?.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-cell">Sem cobranças vencidas.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.full_name ?? "-"}</td>
          <td>${row.title ?? "-"}</td>
          <td>${row.due_date ?? "-"}</td>
          <td>${formatCurrency(row.balance)}</td>
        </tr>
      `
    )
    .join("");
}

async function loadDashboardSummary() {
  const { data, error } = await supabase
    .from("v_dashboard_summary")
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao carregar dashboard:", error.message);
    return;
  }

  setText("total-students", data.total_students ?? 0);
  setText("active-students", data.active_students ?? 0);
  setText("scholarship-students", data.scholarship_students ?? 0);
  setText("payer-students", data.payer_students ?? 0);
  setText("active-classes", data.active_classes ?? 0);
  setText("active-courses", data.active_courses ?? 0);
  setText("total-debt", formatCurrency(data.total_debt));
  setText("received-this-month", formatCurrency(data.received_this_month));
}

async function loadTopDebtors() {
  const { data, error } = await supabase
    .from("v_student_debt_summary")
    .select("*")
    .gt("total_debt", 0)
    .order("total_debt", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Erro ao carregar devedores:", error.message);
    renderTopDebtors([]);
    return;
  }

  renderTopDebtors(data);
}

async function loadOverdueCharges() {
  const { data, error } = await supabase
    .from("v_overdue_charges")
    .select("*")
    .limit(8);

  if (error) {
    console.error("Erro ao carregar vencidos:", error.message);
    renderOverdue([]);
    return;
  }

  renderOverdue(data);
}

export async function initDashboardPage() {
  await Promise.all([
    loadDashboardSummary(),
    loadTopDebtors(),
    loadOverdueCharges(),
  ]);
}
