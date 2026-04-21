import { supabase } from "../config/supabase.js";

const chargesState = {
  charges: [],
  paymentTotalsByChargeId: {},
  students: [],
  classes: [],
  selectedCharge: null,
  lastFetchToken: 0,
  filters: {
    search: "",
    month: "",
    year: "",
    status: "",
    chargeType: ""
  }
};

function formatMoney(value) {
  return new Intl.NumberFormat("pt-MZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function normalizeNumber(value) {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function el(id) {
  return document.getElementById(id);
}

function getChargeTypeLabel(type) {
  if (type === "monthly_fee") return "Mensalidade";
  if (type === "registration_fee") return "Ficha";
  if (type === "test_fee") return "Teste";
  return "-";
}

function getChargeReference(month, year) {
  if (!month || !year) return "-";
  return `${String(month).padStart(2, "0")}/${year}`;
}

function getStatusLabel(status) {
  if (status === "pending") return "Pendente";
  if (status === "partial") return "Parcial";
  if (status === "paid") return "Pago";
  if (status === "cancelled") return "Cancelado";
  return status || "-";
}

async function fetchStudentsForCharges() {
  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      full_name,
      student_number,
      status,
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
    `)
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar alunos:", error);
    chargesState.students = [];
    return [];
  }

  chargesState.students = data || [];
  return chargesState.students;
}

async function fetchClassesForBulk() {
  const { data, error } = await supabase
    .from("classes")
    .select(`
      id,
      name,
      course_id,
      courses (
        id,
        name
      )
    `)
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar turmas:", error);
    chargesState.classes = [];
    return [];
  }

  chargesState.classes = data || [];
  return chargesState.classes;
}

function populateStudentSelect() {
  const select = el("charge-student-id");
  if (!select) return;

  select.innerHTML = `<option value="">Selecionar aluno</option>`;

  chargesState.students.forEach((student) => {
    select.innerHTML += `
      <option value="${student.id}">
        ${student.full_name} ${student.student_number ? `(${student.student_number})` : ""}
      </option>
    `;
  });
}

function populateClassSelect() {
  const select = el("bulk-class-id");
  if (!select) return;

  select.innerHTML = `<option value="">Selecionar turma</option>`;

  chargesState.classes.forEach((item) => {
    const courseName = item.courses?.name || "";
    select.innerHTML += `
      <option value="${item.id}">
        ${item.name}${courseName ? ` - ${courseName}` : ""}
      </option>
    `;
  });
}

function populateYearFilter() {
  const yearSelect = el("chargeYear");
  if (yearSelect) {
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = `<option value="">Ano</option>`;

    for (let year = currentYear + 1; year >= currentYear - 5; year -= 1) {
      yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }
  }

  const currentYear = new Date().getFullYear();
  if (el("charge-year") && !el("charge-year").value) el("charge-year").value = currentYear;
  if (el("bulk-year") && !el("bulk-year").value) el("bulk-year").value = currentYear;

  const today = new Date().toISOString().split("T")[0];
  if (el("payment-date") && !el("payment-date").value) el("payment-date").value = today;
}

async function fetchCharges() {
  const fetchToken = Date.now();
  chargesState.lastFetchToken = fetchToken;

  let query = supabase
    .from("student_charges")
    .select(`
      id,
      student_id,
      charge_type,
      title,
      description,
      notes,
      reference_month,
      reference_year,
      amount,
      discount,
      final_amount,
      paid_amount,
      due_date,
      student_financial_type,
      status,
      created_at,
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
    `)
    .order("created_at", { ascending: false });

  if (chargesState.filters.month) {
    query = query.eq("reference_month", Number(chargesState.filters.month));
  }

  if (chargesState.filters.year) {
    query = query.eq("reference_year", Number(chargesState.filters.year));
  }

  if (chargesState.filters.status) {
    query = query.eq("status", chargesState.filters.status);
  }

  if (chargesState.filters.chargeType) {
    query = query.eq("charge_type", chargesState.filters.chargeType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao carregar cobranças:", error);
    chargesState.charges = [];
    chargesState.paymentTotalsByChargeId = {};
    return [];
  }

  const charges = Array.isArray(data) ? data : [];
  const chargeIds = charges.map((item) => item?.id).filter(Boolean);
  let paymentTotalsByChargeId = {};

  if (chargeIds.length) {
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, charge_id, amount")
      .in("charge_id", chargeIds);

    if (paymentsError) {
      console.error("Erro ao carregar pagamentos para cobranças:", paymentsError);
    } else {
      paymentTotalsByChargeId = (payments || []).reduce((acc, payment) => {
        const chargeId = payment?.charge_id;
        if (!chargeId) return acc;
        acc[chargeId] = normalizeNumber(acc[chargeId]) + normalizeNumber(payment.amount);
        return acc;
      }, {});

      console.log("[finance-debug] payments", payments || []);
    }
  }

  let result = charges.map((item) => {
    const totalExpected = normalizeNumber(item.final_amount ?? item.amount);
    const totalPaid = normalizeNumber(paymentTotalsByChargeId[item.id]);
    const totalDebt = totalExpected - totalPaid;

    return {
      ...item,
      paid_amount: totalPaid,
      balance: totalDebt
    };
  });

  if (chargesState.filters.search.trim()) {
    const term = chargesState.filters.search.trim().toLowerCase();

    result = result.filter((item) => {
      const fullName = item.students?.full_name?.toLowerCase() || "";
      const studentNumber = item.students?.student_number?.toLowerCase() || "";
      const className = item.students?.classes?.name?.toLowerCase() || "";
      const courseName = item.students?.classes?.courses?.name?.toLowerCase() || "";
      const title = item.title?.toLowerCase() || "";
      const typeLabel = getChargeTypeLabel(item.charge_type).toLowerCase();

      return (
        fullName.includes(term) ||
        studentNumber.includes(term) ||
        className.includes(term) ||
        courseName.includes(term) ||
        title.includes(term) ||
        typeLabel.includes(term)
      );
    });
  }

  if (chargesState.lastFetchToken !== fetchToken) {
    return chargesState.charges;
  }

  console.log("[finance-debug] charges", charges);
  chargesState.charges = result;
  chargesState.paymentTotalsByChargeId = paymentTotalsByChargeId;
  return result;
}

function computeDashboard(charges = []) {
  const totalExpected = charges.reduce((sum, item) => sum + normalizeNumber(item.final_amount ?? item.amount), 0);
  const totalPaid = charges.reduce((sum, item) => sum + normalizeNumber(item.paid_amount), 0);
  const totalDebt = totalExpected - totalPaid;
  const paidCount = charges.filter((item) => item.status === "paid").length;

  console.log("[finance-debug] totals", { totalExpected, totalPaid, totalDebt });

  return {
    totalExpected,
    totalPaid,
    totalDebt,
    paidCount
  };
}

function runFinancialValidationScenarios() {
  const scenarios = [
    { name: "1 charge 250 / 1 payment 150", charges: [250], payments: [150], expectedDebt: 100 },
    { name: "1 charge 250 / 2 payments 100+50", charges: [250], payments: [100, 50], expectedDebt: 100 },
    { name: "2 charges 100+200 / 1 payment 150", charges: [100, 200], payments: [150], expectedDebt: 150 },
    { name: "no payments", charges: [250], payments: [], expectedDebt: 250 },
    { name: "no charges", charges: [], payments: [], expectedDebt: 0 }
  ];

  scenarios.forEach((scenario) => {
    const totalExpected = scenario.charges.reduce((sum, value) => sum + normalizeNumber(value), 0);
    const totalPaid = scenario.payments.reduce((sum, value) => sum + normalizeNumber(value), 0);
    const totalDebt = totalExpected - totalPaid;
    const isValid = totalDebt === scenario.expectedDebt;
    console.log("[finance-debug] validation", {
      scenario: scenario.name,
      totalExpected,
      totalPaid,
      totalDebt,
      expectedDebt: scenario.expectedDebt,
      valid: isValid
    });
  });
}

function renderDashboardCards() {
  const stats = computeDashboard(chargesState.charges);

  const expectedEl = document.querySelector('[data-charge-stat="expected"]');
  const paidEl = document.querySelector('[data-charge-stat="paid"]');
  const debtEl = document.querySelector('[data-charge-stat="debt"]');
  const completedEl = document.querySelector('[data-charge-stat="completed"]');

  if (expectedEl) expectedEl.textContent = formatMoney(stats.totalExpected);
  if (paidEl) paidEl.textContent = formatMoney(stats.totalPaid);
  if (debtEl) debtEl.textContent = formatMoney(stats.totalDebt);
  if (completedEl) completedEl.textContent = stats.paidCount;
}

function renderChargesTable() {
  const tbody = el("chargesTableBody");
  if (!tbody) return;

  if (!chargesState.charges.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-cell">Nenhuma cobrança encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = chargesState.charges.map((item) => {
    const student = item.students || {};
    const className = student.classes?.name || "-";
    const courseName = student.classes?.courses?.name || "-";
    const canPay = item.status !== "paid" && item.status !== "cancelled" && Number(item.balance || 0) > 0;

    return `
      <tr>
        <td>${student.full_name || "-"}</td>
        <td>${student.student_number || "-"}</td>
        <td>${courseName}</td>
        <td>${className}</td>
        <td>${getChargeTypeLabel(item.charge_type)}</td>
        <td>${item.title || "-"}</td>
        <td>${getChargeReference(item.reference_month, item.reference_year)}</td>
        <td>${formatMoney(item.final_amount)}</td>
        <td>${formatMoney(item.paid_amount)}</td>
        <td>${formatMoney(item.balance)}</td>
        <td>${getStatusLabel(item.status)}</td>
        <td>
          <div class="table-actions">
            ${canPay ? `<button type="button" class="btn btn-primary btn-sm" onclick="openPaymentModal('${item.id}')">Pagar</button>` : ""}
            <a href="./pagamentos.html?charge_id=${item.id}" class="btn btn-secondary btn-sm">Histórico</a>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function buildChargeTitle(type, month, year, customTitle) {
  if (customTitle?.trim()) return customTitle.trim();

  if (type === "monthly_fee") return `Mensalidade ${String(month).padStart(2, "0")}/${year}`;
  if (type === "registration_fee") return `Pagamento de ficha ${String(month).padStart(2, "0")}/${year}`;
  if (type === "test_fee") return `Pagamento de teste ${String(month).padStart(2, "0")}/${year}`;
  return `Cobrança ${String(month).padStart(2, "0")}/${year}`;
}

async function createSingleCharge({
  studentId,
  chargeType,
  title,
  month,
  year,
  amount,
  discount,
  dueDate,
  financialType,
  notes
}) {
  const numericAmount = Number(amount || 0);
  const numericDiscount = Number(discount || 0);
  const finalAmount = Math.max(0, numericAmount - numericDiscount);

  const payload = {
    student_id: studentId,
    charge_type: chargeType,
    title: buildChargeTitle(chargeType, month, year, title),
    description: null,
    notes: notes || null,
    reference_month: Number(month),
    reference_year: Number(year),
    amount: numericAmount,
    discount: numericDiscount,
    final_amount: finalAmount,
    paid_amount: 0,
    due_date: dueDate || null,
    student_financial_type: financialType || "pagante",
    status: finalAmount === 0 ? "paid" : "pending"
  };

  const { error } = await supabase
    .from("student_charges")
    .insert([payload]);

  if (error) throw error;
}

async function generateBulkCharges({
  classId,
  chargeType,
  title,
  month,
  year,
  amount,
  dueDate,
  notes
}) {
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, class_id, status")
    .eq("class_id", classId)
    .eq("status", "active");

  if (studentsError) throw studentsError;

  if (!students?.length) {
    throw new Error("Nenhum aluno activo encontrado nesta turma.");
  }

  const payload = students.map((student) => ({
    student_id: student.id,
    charge_type: chargeType,
    title: buildChargeTitle(chargeType, month, year, title),
    description: null,
    notes: notes || null,
    reference_month: Number(month),
    reference_year: Number(year),
    amount: Number(amount || 0),
    discount: 0,
    final_amount: Number(amount || 0),
    paid_amount: 0,
    due_date: dueDate || null,
    student_financial_type: "pagante",
    status: Number(amount || 0) === 0 ? "paid" : "pending"
  }));

  const { error } = await supabase
    .from("student_charges")
    .insert(payload);

  if (error) throw error;
}

function openPaymentModalInternal(chargeId) {
  const charge = chargesState.charges.find((item) => item.id === chargeId);
  if (!charge) return;

  chargesState.selectedCharge = charge;

  el("payment-charge-id").value = charge.id;
  el("payment-charge-title").value = `${charge.students?.full_name || "-"} - ${charge.title || "-"}`;
  el("payment-current-balance").value = formatMoney(charge.balance || 0);
  el("payment-amount").value = Number(charge.balance || 0) > 0 ? Number(charge.balance).toFixed(2) : "";
  el("payment-reference").value = "";
  el("payment-notes").value = "";
  el("payment-method").value = "";
  if (!el("payment-date").value) {
    el("payment-date").value = new Date().toISOString().split("T")[0];
  }

  el("payment-modal").classList.remove("hidden");
}

function closePaymentModal() {
  chargesState.selectedCharge = null;
  el("payment-modal").classList.add("hidden");
  const form = el("paymentForm");
  if (form) form.reset();
}

window.openPaymentModal = (chargeId) => {
  openPaymentModalInternal(chargeId);
};

async function registerPayment({ chargeId, amount, paymentDate, method, reference, notes }) {
  const numericAmount = Number(amount || 0);

  if (numericAmount <= 0) {
    throw new Error("O valor de pagamento deve ser maior que zero.");
  }

  const charge = chargesState.charges.find((item) => item.id === chargeId);
  if (!charge) {
    throw new Error("Cobrança não encontrada.");
  }

  const currentBalance = normalizeNumber(charge.balance);
  if (numericAmount > currentBalance) {
    throw new Error("O valor não pode ser superior ao saldo da cobrança.");
  }

  const { error } = await supabase
    .from("payments")
    .insert([{
      student_id: charge.student_id,
      charge_id: chargeId,
      amount: numericAmount,
      payment_date: paymentDate || null,
      payment_method: method || null,
      method: method || null,
      reference: reference || null,
      notes: notes || null
    }]);

  if (error) throw error;
}

function bindChargeFilters() {
  const searchInput = el("chargeSearch");
  const monthSelect = el("chargeMonth");
  const yearSelect = el("chargeYear");
  const statusSelect = el("chargeStatus");
  const typeSelect = el("chargeTypeFilter");

  if (searchInput) {
    searchInput.addEventListener("input", async (event) => {
      chargesState.filters.search = event.target.value;
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
    });
  }

  if (monthSelect) {
    monthSelect.addEventListener("change", async (event) => {
      chargesState.filters.month = event.target.value;
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
    });
  }

  if (yearSelect) {
    yearSelect.addEventListener("change", async (event) => {
      chargesState.filters.year = event.target.value;
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener("change", async (event) => {
      chargesState.filters.status = event.target.value;
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener("change", async (event) => {
      chargesState.filters.chargeType = event.target.value;
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
    });
  }
}

function bindCreateChargeForm() {
  const form = el("chargeForm");
  const resetBtn = el("charge-reset-btn");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    try {
      await createSingleCharge({
        studentId: formData.get("student_id"),
        chargeType: formData.get("charge_type"),
        title: formData.get("title"),
        month: formData.get("reference_month"),
        year: formData.get("reference_year"),
        amount: formData.get("amount"),
        discount: formData.get("discount"),
        dueDate: formData.get("due_date"),
        financialType: formData.get("student_financial_type"),
        notes: formData.get("notes")
      });

      form.reset();
      populateYearFilter();
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
      alert("Cobrança criada com sucesso.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Erro ao criar cobrança.");
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      populateYearFilter();
    });
  }
}

function bindBulkGenerateForm() {
  const form = el("bulkChargeForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    try {
      await generateBulkCharges({
        classId: formData.get("class_id"),
        chargeType: formData.get("charge_type"),
        title: formData.get("title"),
        month: formData.get("reference_month"),
        year: formData.get("reference_year"),
        amount: formData.get("amount"),
        dueDate: formData.get("due_date"),
        notes: formData.get("notes")
      });

      form.reset();
      populateYearFilter();
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
      alert("Cobranças geradas com sucesso.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Erro ao gerar cobranças.");
    }
  });
}

function bindPaymentModal() {
  const form = el("paymentForm");
  const closeBtn = el("close-payment-modal");
  const cancelBtn = el("cancel-payment-btn");
  const modal = el("payment-modal");

  if (closeBtn) {
    closeBtn.addEventListener("click", closePaymentModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closePaymentModal);
  }

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closePaymentModal();
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);

      try {
        await registerPayment({
          chargeId: el("payment-charge-id").value,
          amount: formData.get("amount"),
          paymentDate: formData.get("payment_date"),
          method: formData.get("method"),
          reference: formData.get("reference"),
          notes: formData.get("notes")
        });

        closePaymentModal();
        await fetchCharges();
        renderDashboardCards();
        renderChargesTable();
        alert("Pagamento registado com sucesso.");
      } catch (error) {
        console.error(error);
        alert(error.message || "Erro ao registar pagamento.");
      }
    });
  }
}

export async function initChargesPage() {
  runFinancialValidationScenarios();
  populateYearFilter();
  await fetchStudentsForCharges();
  await fetchClassesForBulk();
  populateStudentSelect();
  populateClassSelect();
  await fetchCharges();
  renderDashboardCards();
  renderChargesTable();
  bindChargeFilters();
  bindCreateChargeForm();
  bindBulkGenerateForm();
  bindPaymentModal();
}
