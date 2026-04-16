import { supabase } from "../config/supabase.js";

const state = {
  students: [],
  classes: [],
  filteredStudents: [],
};

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetStudentForm() {
  el("student-id").value = "";
  el("student-number").value = "";
  el("student-name").value = "";
  el("student-sex").value = "";
  el("student-birth-date").value = "";
  el("student-phone").value = "";
  el("student-email").value = "";
  el("student-document-type").value = "";
  el("student-document-number").value = "";
  el("student-class-id").value = "";
  el("student-type").value = "regular";
  el("student-status").value = "active";
}

function fillStudentForm(student) {
  el("student-id").value = student.id ?? "";
  el("student-number").value = student.student_number ?? "";
  el("student-name").value = student.full_name ?? "";
  el("student-sex").value = student.sex ?? "";
  el("student-birth-date").value = student.birth_date ?? "";
  el("student-phone").value = student.phone ?? "";
  el("student-email").value = student.email ?? "";
  el("student-document-type").value = student.document_type ?? "";
  el("student-document-number").value = student.document_number ?? "";
  el("student-class-id").value = student.class_id ?? "";
  el("student-type").value = student.student_type ?? "regular";
  el("student-status").value = student.status ?? "active";
}

async function fetchClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select(`
      id,
      name,
      courses (
        id,
        name
      )
    `)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar turmas:", error.message);
    alert("Erro ao carregar turmas.");
    return;
  }

  state.classes = data || [];
  renderClassOptions();
}

function renderClassOptions() {
  const select = el("student-class-id");
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecionar turma</option>
    ${state.classes
      .map(
        (item) =>
          `<option value="${item.id}">${escapeHtml(item.name)}${item.courses?.name ? " • " + escapeHtml(item.courses.name) : ""}</option>`
      )
      .join("")}
  `;
}

async function fetchStudents() {
  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      student_number,
      full_name,
      sex,
      birth_date,
      phone,
      email,
      document_type,
      document_number,
      class_id,
      student_type,
      status,
      created_at,
      classes (
        id,
        name,
        courses (
          id,
          name
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar alunos:", error.message);
    alert("Erro ao carregar alunos.");
    return;
  }

  state.students = data || [];
  state.filteredStudents = [...state.students];
  renderStudentsTable();
}

function badgeType(type) {
  if (type === "bolseiro") return "badge badge-green";
  if (type === "regular") return "badge badge-blue";
  return "badge badge-slate";
}

function badgeStatus(status) {
  if (status === "active") return "badge badge-green";
  if (status === "inactive") return "badge badge-slate";
  return "badge badge-slate";
}

function renderStudentsTable() {
  const tbody = el("students-table-body");
  if (!tbody) return;

  if (!state.filteredStudents.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">Nenhum aluno encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.filteredStudents
    .map(
      (student) => `
        <tr>
          <td>${escapeHtml(student.student_number || "-")}</td>
          <td>${escapeHtml(student.full_name || "-")}</td>
          <td>${escapeHtml(student.classes?.courses?.name || "-")}</td>
          <td>${escapeHtml(student.classes?.name || "-")}</td>
          <td><span class="${badgeType(student.student_type)}">${escapeHtml(student.student_type || "-")}</span></td>
          <td><span class="${badgeStatus(student.status)}">${escapeHtml(student.status || "-")}</span></td>
          <td>${escapeHtml(student.phone || "-")}</td>
          <td>
            <div class="action-inline">
              <button class="btn btn-sm btn-edit" data-action="edit" data-id="${student.id}">Editar</button>
              <button class="btn btn-sm btn-danger" data-action="delete" data-id="${student.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function filterStudents(term) {
  const query = term.trim().toLowerCase();

  if (!query) {
    state.filteredStudents = [...state.students];
  } else {
    state.filteredStudents = state.students.filter((student) => {
      return (
        (student.student_number || "").toLowerCase().includes(query) ||
        (student.full_name || "").toLowerCase().includes(query) ||
        (student.phone || "").toLowerCase().includes(query) ||
        (student.email || "").toLowerCase().includes(query) ||
        (student.student_type || "").toLowerCase().includes(query) ||
        (student.status || "").toLowerCase().includes(query) ||
        (student.classes?.name || "").toLowerCase().includes(query) ||
        (student.classes?.courses?.name || "").toLowerCase().includes(query)
      );
    });
  }

  renderStudentsTable();
}

function generateStudentNumber() {
  const total = state.students.length + 1;
  return `KEY-${String(total).padStart(4, "0")}`;
}

async function saveStudent(event) {
  event.preventDefault();

  const id = el("student-id").value.trim();
  const typedNumber = el("student-number").value.trim();

  const payload = {
    student_number: typedNumber || generateStudentNumber(),
    full_name: el("student-name").value.trim(),
    sex: el("student-sex").value || null,
    birth_date: el("student-birth-date").value || null,
    phone: el("student-phone").value.trim() || null,
    email: el("student-email").value.trim() || null,
    document_type: el("student-document-type").value.trim() || null,
    document_number: el("student-document-number").value.trim() || null,
    class_id: el("student-class-id").value || null,
    student_type: el("student-type").value || "regular",
    status: el("student-status").value || "active",
  };

  if (!payload.full_name) {
    alert("O nome do aluno é obrigatório.");
    return;
  }

  let error;

  if (id) {
    ({ error } = await supabase.from("students").update(payload).eq("id", id));
  } else {
    ({ error } = await supabase.from("students").insert([payload]));
  }

  if (error) {
    console.error("Erro ao guardar aluno:", error.message);
    alert(error.message || "Erro ao guardar aluno.");
    return;
  }

  resetStudentForm();
  await fetchStudents();
}

async function deleteStudent(id) {
  const confirmed = window.confirm("Deseja eliminar este aluno?");
  if (!confirmed) return;

  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) {
    console.error("Erro ao eliminar aluno:", error.message);
    alert("Não foi possível eliminar este aluno.");
    return;
  }

  await fetchStudents();
}

function bindEvents() {
  el("student-form")?.addEventListener("submit", saveStudent);

  el("search-students")?.addEventListener("input", (event) => {
    filterStudents(event.target.value);
  });

  el("students-table-body")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const student = state.students.find((item) => item.id === id);

    if (action === "edit" && student) {
      fillStudentForm(student);
      return;
    }

    if (action === "delete" && id) {
      await deleteStudent(id);
    }
  });
}

export async function initStudentsPage() {
  bindEvents();
  await fetchClasses();
  await fetchStudents();
}
