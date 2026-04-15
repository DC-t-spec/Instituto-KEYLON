import { supabase } from "../config/supabase.js";

let allStudents = [];
let allCourses = [];
let allClasses = [];
let currentUserId = null;

function $(selector) {
  return document.querySelector(selector);
}

function formatFinancialType(value) {
  if (value === "payer") {
    return `<span class="badge badge-blue">Pagante</span>`;
  }
  if (value === "scholarship") {
    return `<span class="badge badge-green">Bolseiro</span>`;
  }
  if (value === "partial") {
    return `<span class="badge badge-amber">Parcial</span>`;
  }
  return `<span class="badge badge-slate">-</span>`;
}

function formatStatus(value) {
  const map = {
    active: "Activo",
    inactive: "Inactivo",
    suspended: "Suspenso",
    dropped: "Desistente",
    completed: "Concluído",
  };

  return map[value] || value || "-";
}

function setFormMessage(message, isError = true) {
  const el = $("#student-form-message");
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "var(--danger)" : "var(--success)";
}

function normalizeEmpty(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned === "" ? null : cleaned;
}

function normalizeDate(value) {
  return value ? value : null;
}

function resetStudentForm() {
  $("#student-id").value = "";
  $("#student-form-title").textContent = "Novo aluno";
  $("#student-form").reset();
  $("#financial_type").value = "payer";
  $("#scholarship_type").value = "none";
  $("#status").value = "active";
  $("#enrolled_at").value = new Date().toISOString().slice(0, 10);
  setFormMessage("", true);
}

function populateCourseSelect() {
  const select = $("#course_id");
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecionar curso</option>
    ${allCourses
      .map(
        (course) => `<option value="${course.id}">${course.name}</option>`
      )
      .join("")}
  `;
}

function populateClassSelect(courseId = "") {
  const select = $("#class_id");
  if (!select) return;

  const filteredClasses = courseId
    ? allClasses.filter((item) => item.course_id === courseId)
    : allClasses;

  select.innerHTML = `
    <option value="">Selecionar turma</option>
    ${filteredClasses
      .map(
        (item) => `<option value="${item.id}">${item.name}</option>`
      )
      .join("")}
  `;
}

async function loadCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar cursos:", error.message);
    return;
  }

  allCourses = data || [];
  populateCourseSelect();
}

async function loadClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, course_id")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar turmas:", error.message);
    return;
  }

  allClasses = data || [];
  populateClassSelect();
}

function renderStudentsTable(rows) {
  const tbody = $("#students-table-body");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Nenhum aluno encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (student) => `
        <tr>
          <td>${student.student_number ?? "-"}</td>
          <td>${student.full_name ?? "-"}</td>
          <td>${student.course_name ?? "-"}</td>
          <td>${student.class_name ?? "-"}</td>
          <td>${formatFinancialType(student.financial_type)}</td>
          <td>${formatStatus(student.status)}</td>
          <td>
            <div class="action-inline">
              <button
                type="button"
                class="btn btn-sm btn-edit"
                data-action="edit-student"
                data-id="${student.id}"
              >
                Editar
              </button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

async function loadStudents() {
  const { data, error } = await supabase
    .from("v_students_full")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar alunos:", error.message);
    renderStudentsTable([]);
    return;
  }

  allStudents = data || [];
  renderStudentsTable(allStudents);
}

function applyStudentSearch() {
  const search = ($("#student-search")?.value || "").trim().toLowerCase();

  if (!search) {
    renderStudentsTable(allStudents);
    return;
  }

  const filtered = allStudents.filter((student) => {
    const name = String(student.full_name || "").toLowerCase();
    const number = String(student.student_number || "").toLowerCase();
    return name.includes(search) || number.includes(search);
  });

  renderStudentsTable(filtered);
}

function applyFinancialRules() {
  const financialType = $("#financial_type").value;
  const scholarshipType = $("#scholarship_type");

  if (financialType === "payer") {
    scholarshipType.value = "none";
  }

  if (financialType === "scholarship") {
    if (scholarshipType.value === "none") {
      scholarshipType.value = "full";
    }
  }

  if (financialType === "partial") {
    scholarshipType.value = "partial";
  }
}

function fillStudentForm(studentId) {
  const student = allStudents.find((item) => item.id === studentId);
  if (!student) return;

  $("#student-id").value = student.id || "";
  $("#full_name").value = student.full_name || "";
  $("#student_number").value = student.student_number || "";
  $("#gender").value = student.gender || "";
  $("#birth_date").value = student.birth_date || "";
  $("#phone").value = student.phone || "";
  $("#email").value = student.email || "";
  $("#document_type").value = student.document_type || "";
  $("#document_number").value = student.document_number || "";
  $("#address").value = student.address || "";
  $("#course_id").value = student.course_id || "";
  populateClassSelect(student.course_id || "");
  $("#class_id").value = student.class_id || "";
  $("#financial_type").value = student.financial_type || "payer";
  $("#scholarship_type").value = student.scholarship_type || "none";
  $("#status").value = student.status || "active";
  $("#enrolled_at").value = student.enrolled_at || "";
  $("#scholarship_notes").value = student.scholarship_notes || "";

  $("#student-form-title").textContent = "Editar aluno";
  setFormMessage("", true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildStudentPayload() {
  return {
    student_number: normalizeEmpty($("#student_number").value),
    full_name: normalizeEmpty($("#full_name").value),
    gender: normalizeEmpty($("#gender").value),
    birth_date: normalizeDate($("#birth_date").value),
    phone: normalizeEmpty($("#phone").value),
    email: normalizeEmpty($("#email").value),
    document_type: normalizeEmpty($("#document_type").value),
    document_number: normalizeEmpty($("#document_number").value),
    address: normalizeEmpty($("#address").value),
    course_id: normalizeEmpty($("#course_id").value),
    class_id: normalizeEmpty($("#class_id").value),
    financial_type: $("#financial_type").value,
    scholarship_type: $("#scholarship_type").value,
    scholarship_notes: normalizeEmpty($("#scholarship_notes").value),
    status: $("#status").value,
    enrolled_at: normalizeDate($("#enrolled_at").value),
  };
}

async function createStudent(payload) {
  const { error } = await supabase.from("students").insert([
    {
      ...payload,
      student_number: payload.student_number || null,
    },
  ]);

  if (error) {
    throw error;
  }
}

async function updateStudent(studentId, payload) {
  const { error } = await supabase
    .from("students")
    .update(payload)
    .eq("id", studentId);

  if (error) {
    throw error;
  }
}

async function handleStudentSubmit(event) {
  event.preventDefault();
  setFormMessage("", true);
  applyFinancialRules();

  const studentId = $("#student-id").value;
  const payload = buildStudentPayload();

  if (!payload.full_name) {
    setFormMessage("O nome completo é obrigatório.");
    return;
  }

  const button = $("#save-student-btn");
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = studentId ? "A actualizar..." : "A guardar...";

    if (studentId) {
      await updateStudent(studentId, payload);
      setFormMessage("Aluno actualizado com sucesso.", false);
    } else {
      await createStudent(payload);
      setFormMessage("Aluno criado com sucesso.", false);
    }

    await loadStudents();
    resetStudentForm();
  } catch (error) {
    console.error(error);
    setFormMessage(error.message || "Erro ao guardar aluno.");
  } finally {
    button.disabled = false;
    button.textContent = "Guardar aluno";
  }
}

function bindEvents() {
  $("#student-form")?.addEventListener("submit", handleStudentSubmit);

  $("#reset-student-btn")?.addEventListener("click", () => {
    resetStudentForm();
  });

  $("#student-search")?.addEventListener("input", applyStudentSearch);

  $("#course_id")?.addEventListener("change", (event) => {
    populateClassSelect(event.target.value);
    $("#class_id").value = "";
  });

  $("#financial_type")?.addEventListener("change", () => {
    applyFinancialRules();
  });

  $("#students-table-body")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='edit-student']");
    if (!button) return;

    const studentId = button.getAttribute("data-id");
    if (!studentId) return;

    fillStudentForm(studentId);
  });
}

export async function initStudentsPage(userId) {
  currentUserId = userId;

  $("#enrolled_at").value = new Date().toISOString().slice(0, 10);

  bindEvents();

  await Promise.all([
    loadCourses(),
    loadClasses(),
  ]);

  await loadStudents();
}
