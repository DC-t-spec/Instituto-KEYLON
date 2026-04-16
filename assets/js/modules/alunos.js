import { supabase } from "../config/supabase.js";

const state = {
  students: [],
  classes: [],
  filtered: [],
};

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function resetForm() {
  el("student-form").reset();
  el("student-id").value = "";
}

function fillForm(s) {
  el("student-id").value = s.id || "";
  el("full_name").value = s.full_name || "";
  el("student_number").value = s.student_number || "";
  el("gender").value = s.sex || "";
  el("birth_date").value = s.birth_date || "";
  el("phone").value = s.phone || "";
  el("email").value = s.email || "";
  el("document_type").value = s.document_type || "";
  el("document_number").value = s.document_number || "";
  el("class_id").value = s.class_id || "";
  el("status").value = s.status || "active";
}

async function fetchClasses() {
  const { data } = await supabase
    .from("classes")
    .select(`
      id,
      name,
      courses ( name )
    `);

  state.classes = data || [];

  el("class_id").innerHTML = `
    <option value="">Selecionar turma</option>
    ${state.classes.map(c => `
      <option value="${c.id}">
        ${c.name} ${c.courses?.name ? "• " + c.courses.name : ""}
      </option>
    `).join("")}
  `;
}

async function fetchStudents() {
  const { data } = await supabase
    .from("students")
    .select(`
      *,
      classes (
        name,
        courses ( name )
      )
    `)
    .order("created_at", { ascending: false });

  state.students = data || [];
  state.filtered = [...state.students];

  render();
}

function badge(status) {
  if (status === "active") return "badge badge-green";
  if (status === "inactive") return "badge badge-slate";
  return "badge badge-slate";
}

function render() {
  const tbody = el("students-table-body");

  if (!state.filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7">Sem alunos</td></tr>`;
    return;
  }

  tbody.innerHTML = state.filtered.map(s => `
    <tr>
      <td>${s.student_number || "-"}</td>
      <td>${escapeHtml(s.full_name)}</td>
      <td>${escapeHtml(s.classes?.courses?.name || "-")}</td>
      <td>${escapeHtml(s.classes?.name || "-")}</td>
      <td>${s.student_type || "-"}</td>
      <td><span class="${badge(s.status)}">${s.status}</span></td>
      <td>
        <button data-id="${s.id}" data-action="edit">✏️</button>
        <button data-id="${s.id}" data-action="delete">🗑️</button>
      </td>
    </tr>
  `).join("");
}

function filter(term) {
  const q = term.toLowerCase();

  state.filtered = state.students.filter(s =>
    (s.full_name || "").toLowerCase().includes(q) ||
    (s.student_number || "").toLowerCase().includes(q)
  );

  render();
}

function generateNumber() {
  return "KEY-" + String(state.students.length + 1).padStart(5, "0");
}

async function save(e) {
  e.preventDefault();

  const id = el("student-id").value;

  const payload = {
    full_name: el("full_name").value,
    student_number: el("student_number").value || generateNumber(),
    sex: el("gender").value || null,
    birth_date: el("birth_date").value || null,
    phone: el("phone").value || null,
    email: el("email").value || null,
    document_type: el("document_type").value || null,
    document_number: el("document_number").value || null,
    class_id: el("class_id").value || null,
    status: el("status").value || "active",
  };

  if (!payload.full_name) {
    alert("Nome obrigatório");
    return;
  }

  if (id) {
    await supabase.from("students").update(payload).eq("id", id);
  } else {
    await supabase.from("students").insert([payload]);
  }

  resetForm();
  fetchStudents();
}

async function remove(id) {
  if (!confirm("Eliminar aluno?")) return;

  await supabase.from("students").delete().eq("id", id);
  fetchStudents();
}

function bind() {
  el("student-form").addEventListener("submit", save);

  el("student-search").addEventListener("input", e => {
    filter(e.target.value);
  });

  el("reset-student-btn").addEventListener("click", resetForm);

  el("students-table-body").addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const s = state.students.find(x => x.id === id);

    if (action === "edit") fillForm(s);
    if (action === "delete") remove(id);
  });
}

export async function initStudentsPage() {
  bind();
  await fetchClasses();
  await fetchStudents();
}
