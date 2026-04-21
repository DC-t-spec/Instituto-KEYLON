import { supabase } from "../config/supabase.js";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "MZN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function normalizeNumber(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
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

function getChargeExpectedAmount(charge) {
  return normalizeNumber(charge?.final_amount ?? charge?.amount);
}

function aggregatePaymentsByChargeId(payments = []) {
  return payments.reduce((acc, payment) => {
    const chargeId = payment?.charge_id;
    if (!chargeId) return acc;
    acc[chargeId] = normalizeNumber(acc[chargeId]) + normalizeNumber(payment.amount);
    return acc;
  }, {});
}

async function loadDashboardData() {
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = today.slice(0, 7);

  const [
    studentsResult,
    classesResult,
    coursesResult,
    chargesResult,
    paymentsResult
  ] = await Promise.all([
    supabase.from("students").select(`
      id,
      full_name,
      status,
      financial_type,
      classes (
        id,
        name,
        courses (
          id,
          name
        )
      )
    `),
    supabase.from("classes").select("id, status"),
    supabase.from("courses").select("id, status"),
    supabase.from("student_charges").select("id, student_id, title, due_date, amount, final_amount"),
    supabase.from("payments").select("id, student_id, charge_id, amount, payment_date")
  ]);

  const firstError = [studentsResult, classesResult, coursesResult, chargesResult, paymentsResult]
    .find((result) => result.error)?.error;

  if (firstError) {
    console.error("Erro ao carregar dashboard:", firstError.message || firstError);
    return;
  }

  const students = studentsResult.data || [];
  const classes = classesResult.data || [];
  const courses = coursesResult.data || [];
  const charges = chargesResult.data || [];
  const payments = paymentsResult.data || [];
  const paymentTotalsByChargeId = aggregatePaymentsByChargeId(payments);

  console.log("[finance-debug] charges", charges);
  console.log("[finance-debug] payments", payments);

  const totalExpected = charges.reduce((sum, charge) => sum + getChargeExpectedAmount(charge), 0);
  const totalPaid = payments.reduce((sum, payment) => sum + normalizeNumber(payment.amount), 0);
  const totalDebt = totalExpected - totalPaid;

  console.log("[finance-debug] totals", { totalExpected, totalPaid, totalDebt });

  setText("total-students", students.length);
  setText("active-students", students.filter((student) => student.status === "active").length);
  setText("scholarship-students", students.filter((student) => student.financial_type === "bolseiro").length);
  setText("payer-students", students.filter((student) => student.financial_type !== "bolseiro").length);
  setText("active-classes", classes.filter((item) => item.status === "active").length);
  setText("active-courses", courses.filter((item) => item.status === "active").length);
  setText("total-debt", formatCurrency(totalDebt));

  const receivedThisMonth = payments
    .filter((payment) => (payment.payment_date || "").startsWith(currentMonth))
    .reduce((sum, payment) => sum + normalizeNumber(payment.amount), 0);
  setText("received-this-month", formatCurrency(receivedThisMonth));

  const studentRows = loadTopDebtorsFromRaw(students, charges, paymentTotalsByChargeId);
  renderTopDebtors(studentRows);

  const overdueRows = buildOverdueRows(charges, paymentTotalsByChargeId, students);
  renderOverdue(overdueRows);
}

function loadTopDebtorsFromRaw(students, charges, paymentTotalsByChargeId) {
  const debtByStudentId = charges.reduce((acc, charge) => {
    const chargeId = charge?.id;
    const studentId = charge?.student_id;
    if (!chargeId || !studentId) return acc;

    const chargeExpected = getChargeExpectedAmount(charge);
    const chargePaid = normalizeNumber(paymentTotalsByChargeId[chargeId]);
    const chargeDebt = chargeExpected - chargePaid;

    acc[studentId] = normalizeNumber(acc[studentId]) + chargeDebt;
    return acc;
  }, {});

  return (students || [])
    .map((student) => ({
      full_name: student.full_name,
      course_name: student.classes?.courses?.name || "-",
      class_name: student.classes?.name || "-",
      total_debt: normalizeNumber(debtByStudentId[student.id])
    }))
    .filter((row) => row.total_debt > 0)
    .sort((a, b) => b.total_debt - a.total_debt)
    .slice(0, 8);
}

function buildOverdueRows(charges, paymentTotalsByChargeId, students) {
  const studentById = (students || []).reduce((acc, student) => {
    if (student?.id) acc[student.id] = student;
    return acc;
  }, {});

  const today = new Date().toISOString().split("T")[0];

  return charges
    .map((charge) => {
      const expected = getChargeExpectedAmount(charge);
      const paid = normalizeNumber(paymentTotalsByChargeId[charge.id]);
      const balance = expected - paid;

      return {
        full_name: studentById[charge.student_id]?.full_name || "-",
        title: charge.title || "-",
        due_date: charge.due_date || "-",
        balance,
      };
    })
    .filter((row) => row.due_date !== "-" && row.due_date < today && row.balance > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 8);
}

export async function initDashboardPage() {
  await loadDashboardData();
}
