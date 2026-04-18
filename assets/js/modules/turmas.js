import { supabase } from "../config/supabase.js";

const els = {};

function getEls() {
  els.search = document.getElementById("search-turmas");
  els.newBtn = document.getElementById("btn-nova-turma");
  els.cancelBtn = document.getElementById("btn-cancelar-turma");
  els.formContainer = document.getElementById("turma-form-container");
  els.form = document.getElementById("turma-form");
  els.tableBody = document.getElementById("turmas-table-body");

  els.id = document.getElementById("turma-id");
  els.courseId = document.getElementById("turma-curso-id");
  els.name = document.getElementById("turma-nome");
  els.code = document.getElementById("turma-codigo");
  els.period = document.getElementById("turma-periodo");
  els.year = document.getElementById("turma-ano");
  els.capacity = document.getElementById("turma-capacidade");
  els.startDate = document.getElementById("turma-data-inicio");
  els.endDate = document.getElementById("turma-data-fim");
  els.status = document.getElementById("turma-status");
}

function toggleForm(show) {
  if (!els.formContainer) return;
  els.formContainer.classList.toggle("hidden", !show);
}

function clearForm() {
  if (els.id) els.id.value = "";
  if (els.courseId) els.courseId.value = "";
  if (els.name) els.name.value = "";
  if (els.code) els.code.value = "";
  if (els.period) els.period.value = "";
  if (els.year) els.year.value = "";
  if (els.capacity) els.capacity.value = "0";
  if (els.startDate) els.startDate.value = "";
  if (els.endDate) els.endDate.value = "";
  if (els.status) els.status.value = "active";
}

function renderTurmas(rows) {
  if (!els.tableBody) return;

  if (!rows.length) {
    els.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Sem turmas registadas.</td>
      </tr>
    `;
    return;
  }

  els.tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.name || "-"}</td>
        <td>${row.courses?.name || "-"}</td>
          <td>${row.period || "-"}</td>
          <td>${row.year || "-"}</td>
          <td>${row.capacity ?? 0}</td>
          <td>${formatStatus(row.status)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-edit-id="${row.id}">Editar</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function formatStatus(status) {
  if (status === "active") return "Activo";
  if (status === "closed") return "Fechado";
  if (status === "cancelled") return "Cancelado";
  return status || "-";
}

async function loadCoursesOptions() {
  if (!els.courseId) return;

  const { data, error } = await supabase
    .from("courses")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("Erro ao carregar cursos:", error);
    return;
  }

  els.courseId.innerHTML = `
    <option value="">Selecionar curso</option>
    ${(data || [])
      .map((course) => `<option value="${course.id}">${course.name}</option>`)
      .join("")}
  `;
}

async function loadTurmas() {
  if (!els.tableBody) return;

  els.tableBody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-cell">A carregar turmas...</td>
    </tr>
  `;

 const { data, error } = await supabase
  .from("classes")
  .select(`
    id,
    name,
    code,
    period,
    year,
    capacity,
    start_date,
    end_date,
    status,
    created_at,
    course_id,
    courses (
      name
    )
  `)
  .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar turmas:", error);
    els.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Erro ao carregar turmas.</td>
      </tr>
    `;
    return;
  }

  const term = (els.search?.value || "").trim().toLowerCase();

 const filtered = (data || []).filter((row) => {
  const courseName = row.courses?.name || "";

  if (!term) return true;

  return (
    (row.name || "").toLowerCase().includes(term) ||
    courseName.toLowerCase().includes(term) ||
    (row.period || "").toLowerCase().includes(term) ||
    String(row.year || "").toLowerCase().includes(term)
  );
});

  renderTurmas(filtered);
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = {
    course_id: els.courseId?.value || null,
    name: els.name?.value?.trim() || null,
    code: els.code?.value?.trim() || null,
    period: els.period?.value?.trim() || null,
    year: els.year?.value ? Number(els.year.value) : null,
    capacity: els.capacity?.value ? Number(els.capacity.value) : 0,
    start_date: els.startDate?.value || null,
    end_date: els.endDate?.value || null,
    status: els.status?.value || "active",
  };

  if (!payload.course_id || !payload.name) {
    alert("Preencha curso e nome da turma.");
    return;
  }

  const editingId = els.id?.value;

  let error;

  if (editingId) {
    ({ error } = await supabase
      .from("classes")
      .update(payload)
      .eq("id", editingId));
  } else {
    ({ error } = await supabase.from("classes").insert([payload]));
  }

  if (error) {
    console.error("Erro ao guardar turma:", error);
    alert("Erro ao guardar turma.");
    return;
  }

  clearForm();
  toggleForm(false);
  await loadTurmas();
}

async function handleTableClick(event) {
  const editBtn = event.target.closest("[data-edit-id]");
  if (!editBtn) return;

  const id = editBtn.getAttribute("data-edit-id");

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    console.error("Erro ao carregar turma:", error);
    return;
  }

  if (els.id) els.id.value = data.id || "";
  if (els.courseId) els.courseId.value = data.course_id || "";
  if (els.name) els.name.value = data.name || "";
  if (els.code) els.code.value = data.code || "";
  if (els.period) els.period.value = data.period || "";
  if (els.year) els.year.value = data.year || "";
  if (els.capacity) els.capacity.value = data.capacity ?? 0;
  if (els.startDate) els.startDate.value = data.start_date || "";
  if (els.endDate) els.endDate.value = data.end_date || "";
  if (els.status) els.status.value = data.status || "active";

  toggleForm(true);
}

export async function initTurmasPage() {
  getEls();

  if (!els.tableBody) {
    console.error("Elemento #turmas-table-body não encontrado.");
    return;
  }

  if (els.newBtn) {
    els.newBtn.addEventListener("click", () => {
      clearForm();
      toggleForm(true);
    });
  }

  if (els.cancelBtn) {
    els.cancelBtn.addEventListener("click", () => {
      clearForm();
      toggleForm(false);
    });
  }

  if (els.search) {
    els.search.addEventListener("input", loadTurmas);
  }

  if (els.form) {
    els.form.addEventListener("submit", handleSubmit);
  }

  if (els.tableBody) {
    els.tableBody.addEventListener("click", handleTableClick);
  }

  await loadCoursesOptions();
  await loadTurmas();
}
