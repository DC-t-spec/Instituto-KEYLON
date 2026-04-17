import { supabase } from "../config/supabase.js";

const paymentsState = {
  payments: [],
  filters: {
    search: "",
    method: "",
    chargeId: new URLSearchParams(window.location.search).get("charge_id") || ""
  }
};

function el(id) {
  return document.getElementById(id);
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-MZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function getChargeTypeLabel(type) {
  if (type === "monthly_fee") return "Mensalidade";
  if (type === "registration_fee") return "Ficha";
  if (type === "test_fee") return "Teste";
  return "-";
}

function getMethodLabel(method) {
  if (method === "cash") return "Dinheiro";
  if (method === "mpesa") return "M-Pesa";
  if (method === "bank") return "Banco";
  if (method === "card") return "Cartão";
  return method || "-";
}

async function fetchPayments() {
  let query = supabase
    .from("payments")
    .select(`
      id,
      charge_id,
      amount,
      payment_date,
      method,
      reference,
      notes,
      created_at,
      student_charges (
        id,
        title,
        charge_type,
        student_id,
        students (
          id,
          full_name,
          student_number,
          class_id,
          classes (
            id,
            name,
            course_id,
            courses (
              id,
              name
            )
          )
        )
      )
    `)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (paymentsState.filters.chargeId) {
    query = query.eq("charge_id", paymentsState.filters.chargeId);
  }

  if (paymentsState.filters.method) {
    query = query.eq("method", paymentsState.filters.method);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao carregar pagamentos:", error);
    paymentsState.payments = [];
    return [];
  }

  let rows = data || [];

  if (paymentsState.filters.search.trim()) {
    const term = paymentsState.filters.search.trim().toLowerCase();

    rows = rows.filter((item) => {
      const student = item.student_charges?.students;
      const className = student?.classes?.name?.toLowerCase() || "";
      const courseName = student?.classes?.courses?.name?.toLowerCase() || "";
      const fullName = student?.full_name?.toLowerCase() || "";
      const studentNumber = student?.student_number?.toLowerCase() || "";
      const reference = item.reference?.toLowerCase() || "";
      const title = item.student_charges?.title?.toLowerCase() || "";

      return (
        fullName.includes(term) ||
        studentNumber.includes(term) ||
        className.includes(term) ||
        courseName.includes(term) ||
        reference.includes(term) ||
        title.includes(term)
      );
    });
  }

  paymentsState.payments = rows;
  return rows;
}

function renderStats() {
  const rows = paymentsState.payments;

  const total = rows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const today = new Date().toISOString().split("T")[0];
  const totalToday = rows
    .filter((item) => item.payment_date === today)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const methodsUsed = new Set(
    rows
      .map((item) => item.method)
      .filter(Boolean)
  ).size;

  el("payments-count").textContent = rows.length;
  el("payments-total").textContent = formatMoney(total);
  el("payments-today").textContent = formatMoney(totalToday);
  el("payments-methods").textContent = methodsUsed;
}

function renderTable() {
  const tbody = el("paymentsTableBody");
  if (!tbody) return;

  if (!paymentsState.payments.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-cell">Nenhum pagamento encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paymentsState.payments.map((item) => {
    const charge = item.student_charges || {};
    const student = charge.students || {};
    const className = student.classes?.name || "-";
    const courseName = student.classes?.courses?.name || "-";

    return `
      <tr>
        <td>${student.full_name || "-"}</td>
        <td>${student.student_number || "-"}</td>
        <td>${courseName}</td>
        <td>${className}</td>
        <td>${charge.title || "-"}</td>
        <td>${getChargeTypeLabel(charge.charge_type)}</td>
        <td>${formatMoney(item.amount)}</td>
        <td>${item.payment_date || "-"}</td>
        <td>${getMethodLabel(item.method)}</td>
        <td>${item.reference || "-"}</td>
      </tr>
    `;
  }).join("");
}

function bindFilters() {
  const searchInput = el("paymentSearch");
  const methodSelect = el("paymentMethodFilter");

  if (searchInput) {
    searchInput.addEventListener("input", async (event) => {
      paymentsState.filters.search = event.target.value || "";
      await fetchPayments();
      renderStats();
      renderTable();
    });
  }

  if (methodSelect) {
    methodSelect.addEventListener("change", async (event) => {
      paymentsState.filters.method = event.target.value || "";
      await fetchPayments();
      renderStats();
      renderTable();
    });
  }
}

export async function initPaymentsPage() {
  await fetchPayments();
  renderStats();
  renderTable();
  bindFilters();
}
