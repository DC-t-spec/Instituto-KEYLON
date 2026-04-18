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
      student_id,
      amount,
      payment_date,
      method,
      payment_method,
      reference,
      notes,
      created_at,
      student_charges!payments_charge_id_fkey (
        id,
        title,
        charge_type
      ),
      students!payments_student_id_fkey (
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
    `)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (paymentsState.filters.chargeId) {
    query = query.eq("charge_id", paymentsState.filters.chargeId);
  }

  if (paymentsState.filters.method) {
    query = query.or(
      `method.eq.${paymentsState.filters.method},payment_method.eq.${paymentsState.filters.method}`
    );
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
      const student = item.students;
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
      .map((item) => item.method || item.payment_method)
      .filter(Boolean)
  ).size;

  if (el("payments-count")) el("payments-count").textContent = rows.length;
  if (el("payments-total")) el("payments-total").textContent = formatMoney(total);
  if (el("payments-today")) el("payments-today").textContent = formatMoney(totalToday);
  if (el("payments-methods")) el("payments-methods").textContent = methodsUsed;
}

function renderTable() {
  const tbody = el("paymentsTableBody");
  if (!tbody) return;

  if (!paymentsState.payments.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-cell">Nenhum pagamento encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paymentsState.payments.map((item) => {
    const charge = item.student_charges || {};
    const student = item.students || {};
    const className = student.classes?.name || "-";
    const courseName = student.classes?.courses?.name || "-";
    const methodValue = item.method || item.payment_method;

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
        <td>${getMethodLabel(methodValue)}</td>
        <td>${item.reference || "-"}</td>
        <td>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="receipt"
            data-id="${item.id}"
          >
            Recibo
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function openReceipt(payment) {
  const charge = payment.student_charges || {};
  const student = payment.students || {};
  const className = student.classes?.name || "-";
  const courseName = student.classes?.courses?.name || "-";
  const methodValue = payment.method || payment.payment_method;

  const receiptWindow = window.open("", "_blank", "width=900,height=700");

  if (!receiptWindow) {
    alert("Não foi possível abrir o recibo.");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8" />
      <title>Recibo</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 32px;
          color: #0f172a;
        }
        .receipt {
          max-width: 760px;
          margin: 0 auto;
          border: 1px solid #cbd5e1;
          border-radius: 16px;
          overflow: hidden;
        }
        .header {
          padding: 24px 28px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .header h1 {
          margin: 0 0 8px;
          font-size: 28px;
        }
        .header p {
          margin: 0;
          color: #475569;
        }
        .content {
          padding: 28px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 24px;
          margin-bottom: 24px;
        }
        .item strong {
          display: block;
          font-size: 12px;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 4px;
        }
        .amount {
          font-size: 32px;
          font-weight: 700;
          margin: 20px 0;
        }
        .footer {
          padding: 20px 28px 28px;
          color: #475569;
        }
        .actions {
          margin-top: 24px;
        }
        button {
          padding: 10px 16px;
          border: 0;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
        }
        .print-btn {
          background: #0f172a;
          color: white;
        }
        @media print {
          .actions {
            display: none;
          }
          body {
            padding: 0;
          }
          .receipt {
            border: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>Recibo de Pagamento</h1>
          <p>KEYLON Instituto</p>
        </div>

        <div class="content">
          <div class="grid">
            <div class="item">
              <strong>Aluno</strong>
              <span>${student.full_name || "-"}</span>
            </div>
            <div class="item">
              <strong>Número</strong>
              <span>${student.student_number || "-"}</span>
            </div>
            <div class="item">
              <strong>Curso</strong>
              <span>${courseName}</span>
            </div>
            <div class="item">
              <strong>Turma</strong>
              <span>${className}</span>
            </div>
            <div class="item">
              <strong>Cobrança</strong>
              <span>${charge.title || "-"}</span>
            </div>
            <div class="item">
              <strong>Tipo</strong>
              <span>${getChargeTypeLabel(charge.charge_type)}</span>
            </div>
            <div class="item">
              <strong>Data</strong>
              <span>${payment.payment_date || "-"}</span>
            </div>
            <div class="item">
              <strong>Método</strong>
              <span>${getMethodLabel(methodValue)}</span>
            </div>
            <div class="item">
              <strong>Referência</strong>
              <span>${payment.reference || "-"}</span>
            </div>
          </div>

          <div class="amount">
            Valor pago: ${formatMoney(payment.amount)} MTn
          </div>

          <div class="item">
            <strong>Observações</strong>
            <span>${payment.notes || "-"}</span>
          </div>

          <div class="actions">
            <button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
          </div>
        </div>

        <div class="footer">
          Emitido automaticamente pelo sistema KEYLON.
        </div>
      </div>
    </body>
    </html>
  `;

  receiptWindow.document.open();
  receiptWindow.document.write(html);
  receiptWindow.document.close();
}

function handleTableClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  const payment = paymentsState.payments.find((item) => item.id === id);

  if (!payment) return;

  if (action === "receipt") {
    openReceipt(payment);
  }
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
  el("paymentsTableBody")?.addEventListener("click", handleTableClick);
}
