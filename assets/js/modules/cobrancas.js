const supabase = window.supabaseClient;

const chargesState = {
  charges: [],
  students: [],
  filters: {
    search: "",
    month: "",
    year: "",
    status: ""
  }
};

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
    return [];
  }

  chargesState.students = data || [];
  return chargesState.students;
}

async function fetchCharges() {
  let query = supabase
    .from("student_charges")
    .select(`
      id,
      student_id,
      charge_type,
      reference_month,
      reference_year,
      student_financial_type,
      scholarship_percent,
      base_amount,
      discount_amount,
      final_amount,
      paid_amount,
      balance_amount,
      due_date,
      status,
      notes,
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
    .order("reference_year", { ascending: false })
    .order("reference_month", { ascending: false })
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

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao carregar cobranças:", error);
    chargesState.charges = [];
    return [];
  }

  let result = data || [];

  if (chargesState.filters.search.trim()) {
    const term = chargesState.filters.search.trim().toLowerCase();

    result = result.filter((item) => {
      const fullName = item.students?.full_name?.toLowerCase() || "";
      const studentNumber = item.students?.student_number?.toLowerCase() || "";
      const className = item.students?.classes?.name?.toLowerCase() || "";
      const courseName = item.students?.classes?.courses?.name?.toLowerCase() || "";

      return (
        fullName.includes(term) ||
        studentNumber.includes(term) ||
        className.includes(term) ||
        courseName.includes(term)
      );
    });
  }

  chargesState.charges = result;
  return result;
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-MZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function getChargeReference(month, year) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function computeDashboard(charges = []) {
  const totalExpected = charges.reduce((sum, item) => sum + Number(item.final_amount || 0), 0);
  const totalPaid = charges.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
  const totalDebt = charges.reduce((sum, item) => sum + Number(item.balance_amount || 0), 0);

  const pendingCount = charges.filter((item) => item.status === "pending").length;
  const partialCount = charges.filter((item) => item.status === "partial").length;
  const paidCount = charges.filter((item) => item.status === "paid").length;

  return {
    totalExpected,
    totalPaid,
    totalDebt,
    pendingCount,
    partialCount,
    paidCount
  };
}

function renderDashboardCards() {
  const stats = computeDashboard(chargesState.charges);

  const expectedEl = document.querySelector('[data-charge-stat="expected"]');
  const paidEl = document.querySelector('[data-charge-stat="paid"]');
  const debtEl = document.querySelector('[data-charge-stat="debt"]');
  const pendingEl = document.querySelector('[data-charge-stat="pending"]');
  const partialEl = document.querySelector('[data-charge-stat="partial"]');
  const completedEl = document.querySelector('[data-charge-stat="completed"]');

  if (expectedEl) expectedEl.textContent = formatMoney(stats.totalExpected);
  if (paidEl) paidEl.textContent = formatMoney(stats.totalPaid);
  if (debtEl) debtEl.textContent = formatMoney(stats.totalDebt);
  if (pendingEl) pendingEl.textContent = stats.pendingCount;
  if (partialEl) partialEl.textContent = stats.partialCount;
  if (completedEl) completedEl.textContent = stats.paidCount;
}

function renderChargesTable() {
  const tbody = document.querySelector("#chargesTableBody");
  if (!tbody) return;

  if (!chargesState.charges.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center">Nenhuma cobrança encontrada.</td>
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
        <td>${getChargeReference(item.reference_month, item.reference_year)}</td>
        <td>${item.student_financial_type}</td>
        <td>${formatMoney(item.final_amount)}</td>
        <td>${formatMoney(item.paid_amount)}</td>
        <td>${formatMoney(item.balance_amount)}</td>
        <td>
          <span class="status-badge status-${item.status}">
            ${item.status}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

async function createSingleCharge({
  studentId,
  month,
  year,
  baseAmount,
  financialType,
  scholarshipPercent,
  dueDate,
  notes
}) {
  const percent = Number(scholarshipPercent || 0);
  const base = Number(baseAmount || 0);
  const discount = Number(((base * percent) / 100).toFixed(2));
  const finalAmount = Number((base - discount).toFixed(2));

  const payload = {
    student_id: studentId,
    charge_type: "monthly_fee",
    reference_month: Number(month),
    reference_year: Number(year),
    student_financial_type: financialType,
    scholarship_percent: percent,
    base_amount: base,
    discount_amount: discount,
    final_amount: finalAmount,
    paid_amount: 0,
    due_date: dueDate || null,
    status: finalAmount === 0 ? "paid" : "pending",
    notes: notes || null
  };

  const { error } = await supabase
    .from("student_charges")
    .insert(payload);

  if (error) throw error;
}

async function generateBulkCharges({ month, year, baseAmount, dueDate }) {
  const activeStudents = chargesState.students.length
    ? chargesState.students
    : await fetchStudentsForCharges();

  const payload = activeStudents.map((student) => ({
    student_id: student.id,
    charge_type: "monthly_fee",
    reference_month: Number(month),
    reference_year: Number(year),
    student_financial_type: "pagante",
    scholarship_percent: 0,
    base_amount: Number(baseAmount),
    discount_amount: 0,
    final_amount: Number(baseAmount),
    paid_amount: 0,
    due_date: dueDate || null,
    status: "pending"
  }));

  if (!payload.length) return;

  const { error } = await supabase
    .from("student_charges")
    .upsert(payload, {
      onConflict: "student_id,charge_type,reference_month,reference_year",
      ignoreDuplicates: true
    });

  if (error) throw error;
}

async function registerPayment(chargeId, amount) {
  const charge = chargesState.charges.find((item) => item.id === chargeId);
  if (!charge) return;

  const finalAmount = Number(charge.final_amount || 0);
  const paidAmount = Number(charge.paid_amount || 0);
  let newPaid = paidAmount + Number(amount || 0);

  if (newPaid < 0) newPaid = 0;
  if (newPaid > finalAmount) newPaid = finalAmount;

  let newStatus = "pending";
  if (newPaid === 0) newStatus = "pending";
  else if (newPaid < finalAmount) newStatus = "partial";
  else newStatus = "paid";

  const { error } = await supabase
    .from("student_charges")
    .update({
      paid_amount: newPaid,
      status: newStatus
    })
    .eq("id", chargeId);

  if (error) throw error;
}

function bindChargeFilters() {
  const searchInput = document.querySelector("#chargeSearch");
  const monthSelect = document.querySelector("#chargeMonth");
  const yearSelect = document.querySelector("#chargeYear");
  const statusSelect = document.querySelector("#chargeStatus");

  if (searchInput) {
    searchInput.addEventListener("input", async (e) => {
      chargesState.filters.search = e.target.value;
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
    });
  }

  if (monthSelect) {
    monthSelect.addEventListener("change", async (e) => {
      chargesState.filters.month = e.target.value;
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
    });
  }

  if (yearSelect) {
    yearSelect.addEventListener("change", async (e) => {
      chargesState.filters.year = e.target.value;
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener("change", async (e) => {
      chargesState.filters.status = e.target.value;
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
    });
  }
}

function bindCreateChargeForm() {
  const form = document.querySelector("#chargeForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    try {
      await createSingleCharge({
        studentId: formData.get("student_id"),
        month: formData.get("reference_month"),
        year: formData.get("reference_year"),
        baseAmount: formData.get("base_amount"),
        financialType: formData.get("student_financial_type") || "pagante",
        scholarshipPercent: formData.get("scholarship_percent") || 0,
        dueDate: formData.get("due_date"),
        notes: formData.get("notes")
      });

      form.reset();
      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
      alert("Cobrança criada com sucesso.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Erro ao criar cobrança.");
    }
  });
}

function bindBulkGenerateForm() {
  const form = document.querySelector("#bulkChargeForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    try {
      await generateBulkCharges({
        month: formData.get("reference_month"),
        year: formData.get("reference_year"),
        baseAmount: formData.get("base_amount"),
        dueDate: formData.get("due_date")
      });

      await fetchCharges();
      renderDashboardCards();
      renderChargesTable();
      alert("Mensalidades geradas com sucesso.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Erro ao gerar mensalidades.");
    }
  });
}

async function initChargesPage() {
  await fetchStudentsForCharges();
  await fetchCharges();
  renderDashboardCards();
  renderChargesTable();
  bindChargeFilters();
  bindCreateChargeForm();
  bindBulkGenerateForm();
}

window.KEYLON_CHARGES = {
  initChargesPage,
  fetchCharges,
  createSingleCharge,
  generateBulkCharges,
  registerPayment
};
