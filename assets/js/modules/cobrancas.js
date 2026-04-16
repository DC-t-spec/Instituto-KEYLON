import { supabase } from "../config/supabase.js";

const chargesState = {
  charges: [],
  students: [],
  classes: [],
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
  if (!yearSelect) return;

  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = `<option value="">Ano</option>`;

  for (let year = currentYear + 1; year >= currentYear - 5; year -= 1) {
    yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
  }

  const chargeYearInput = el("charge-year");
  const bulkYearInput = el("bulk-year");

  if (chargeYearInput && !chargeYearInput.value) chargeYearInput.value = currentYear;
  if (bulkYearInput && !bulkYearInput.value) bulkYearInput.value = currentYear;
}

async function fetchCharges() {
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
    return [];
  }

  let result = (data || []).map((item) => ({
    ...item,
    balance: Number(item.final_amount || 0) - Number(item.paid_amount || 0)
  }));

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

  chargesState.charges = result;
  return result;
}

function computeDashboard(charges = []) {
  const totalExpected = charges.reduce((sum, item) => sum + Number(item.final_amount || 0), 0);
  const totalPaid = charges.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
  const totalDebt = charges.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const paidCount = charges.filter((item) => item.status === "paid").length;

  return {
    totalExpected,
    totalPaid,
    totalDebt,
    paidCount
  };
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
        <td colspan="11" class="empty-cell">Nenhuma cobrança encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = chargesState.charges.map((item) => {
    const student = item.students || {};
    const className = student.classes?.name || "-";
    const courseName = student.classes?.courses?.name || "-";

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
        <td>${item.status || "-"}</td>
      </tr>
    `;
  }).join("");
}

function buildChargeTitle(type, month, year, customTitle) {
  if (customTitle?.trim()) return customTitle.trim();

  if (type === "monthly_fee") {
    return `Mensalidade ${String(month).padStart(2, "0")}/${year}`;
  }

  if (type === "registration_fee") {
    return `Pagamento de ficha ${String(month).padStart(2, "0")}/${year}`;
  }

  if (type === "test_fee") {
    return `Pagamento de teste ${String(month).padStart(2, "0")}/${year}`;
  }

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
    .select("id, full_name, class_id, status")
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

async function initChargesPage() {
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
}

export {
  initChargesPage
};
