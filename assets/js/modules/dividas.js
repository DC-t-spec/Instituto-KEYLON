import { supabase } from "../config/supabase.js";

let data = [];

export async function initDividas() {
  await load();
  setup();
}

async function load() {
  const { data: rows, error } = await supabase
    .from("v_student_debt_summary")
    .select("*")
    .order("total_debt", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  data = rows || [];
  renderCards();
  renderTable(data);
}

function renderCards() {
  const totalDebt = sum(data, "total_debt");
  const totalPaid = sum(data, "total_paid");
  const totalStudents = data.length;
  const overdueStudents = data.filter(d => d.overdue_count > 0).length;

  document.getElementById("cards").innerHTML = `
    <div class="stat-card">💰 Dívida Total<br><strong>${fmt(totalDebt)}</strong></div>
    <div class="stat-card">✅ Pago<br><strong>${fmt(totalPaid)}</strong></div>
    <div class="stat-card">👥 Devedores<br><strong>${totalStudents}</strong></div>
    <div class="stat-card">⚠️ Atrasados<br><strong>${overdueStudents}</strong></div>
  `;
}

function renderTable(rows) {
  const tbody = document.getElementById("dividas-table-body");

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">Sem dados</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.full_name}</td>
      <td>${r.course_name || "-"}</td>
      <td>${r.class_name || "-"}</td>
      <td>${fmt(r.total_charged)}</td>
      <td>${fmt(r.total_paid)}</td>
      <td class="text-danger">${fmt(r.total_debt)}</td>
      <td>${badge(r)}</td>
    </tr>
  `).join("");
}

function setup() {
  document.getElementById("search")?.addEventListener("input", filter);
}

function filter(e) {
  const q = e.target.value.toLowerCase();

  const filtered = data.filter(d =>
    d.full_name.toLowerCase().includes(q)
  );

  renderTable(filtered);
}

function sum(arr, field) {
  return arr.reduce((a, b) => a + Number(b[field] || 0), 0);
}

function fmt(v) {
  return Number(v || 0).toLocaleString("pt-MZ") + " MZN";
}

function badge(r) {
  if (r.total_debt === 0) return `<span class="badge green">Sem dívida</span>`;
  if (r.overdue_count > 0) return `<span class="badge red">Atrasado</span>`;
  return `<span class="badge yellow">Pendente</span>`;
}
