import { supabase } from "../config/supabase.js";

const state = {
  classes: [],
  courses: [],
  search: ""
};

function el(id) {
  return document.getElementById(id);
}

function showForm() {
  const container = el("turma-form-container");
  if (container) container.classList.remove("hidden");
}

function hideForm() {
  const container = el("turma-form-container");
  if (container) container.classList.add("hidden");
}

function resetForm() {
  const form = el("turma-form");
  if (form) form.reset();

  if (el("turma-id")) el("turma-id").value = "";

  const statusEl = el("turma-status");
  if (statusEl) statusEl.value = "active";
}

async function fetchCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar cursos:", error.message);
    state.courses = [];
    return;
  }

  state.courses = data || [];

  const select = el("turma-curso-id");
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecionar curso</option>
    ${state.courses.map(course => `
      <option value="${course.id}">${course.name}</option>
    `).join("")}
  `;
}

async function fetchClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select(`
      *,
      courses (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar turmas:", error.message);
    state.classes = [];
    render();
    return;
  }

  state.classes = data || [];
  render();
}

function render() {
  const tbody = el("turmas-table-body");
  if (!tbody) return;

  let rows = [...state.classes];

  if (state.search.trim()) {
    const term = state.search.trim().toLowerCase();

    rows = rows.filter((item) => {
      const name = item.name?.toLowerCase() || "";
      const course = item.courses?.name?.toLowerCase() || "";
      const period = item.period?.toLowerCase() || "";
      const year = String(item.year || "").toLowerCase();

      return (
        name.includes(term) ||
        course.includes(term) ||
        period.includes(term) ||
        year.includes(term)
      );
    });
  }

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Nenhuma turma encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((t) => `
    <tr>
      <td>${t.name || "-"}</td>
      <td>${t.courses?.name || "-"}</td>
      <td>${t.period || "-"}</td>
      <td>${t.year || "-"}</td>
      <td>${t.capacity ?? "-"}</td>
      <td>${t.status || "-"}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="btn btn-secondary btn-sm" onclick="editClass('${t.id}')">
            Editar
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="deleteClass('${t.id}')">
            Eliminar
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

window.editClass = (id) => {
  const turma = state.classes.find((item) => item.id === id);
  if (!turma) return;

  showForm();

  if (el("turma-id")) el("turma-id").value = turma.id;
  if (el("turma-nome")) el("turma-nome").value = turma.name || "";
  if (el("turma-curso-id")) el("turma-curso-id").value = turma.course_id || "";
  if (el("turma-codigo")) el("turma-codigo").value = turma.code || "";
  if (el("turma-periodo")) el("turma-periodo").value = turma.period || "";
  if (el("turma-ano")) el("turma-ano").value = turma.year || "";
  if (el("turma-capacidade")) el("turma-capacidade").value = turma.capacity ?? 0;
  if (el("turma-data-inicio")) el("turma-data-inicio").value = turma.start_date || "";
  if (el("turma-data-fim")) el("turma-data-fim").value = turma.end_date || "";
  if (el("turma-status")) el("turma-status").value = turma.status || "active";
};

window.deleteClass = async (id) => {
  const confirmed = confirm("Eliminar turma?");
  if (!confirmed) return;

  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao eliminar turma:", error.message);
    alert("Não foi possível eliminar a turma.");
    return;
  }

  await fetchClasses();
};

async function save(event) {
  event.preventDefault();

  const id = el("turma-id")?.value || "";

  const payload = {
    name: el("turma-nome")?.value?.trim() || "",
    course_id: el("turma-curso-id")?.value || null,
    code: el("turma-codigo")?.value?.trim() || null,
    period: el("turma-periodo")?.value?.trim() || null,
    year: el("turma-ano")?.value ? Number(el("turma-ano").value) : null,
    capacity: el("turma-capacidade")?.value ? Number(el("turma-capacidade").value) : 0,
    start_date: el("turma-data-inicio")?.value || null,
    end_date: el("turma-data-fim")?.value || null,
    status: el("turma-status")?.value || "active"
  };

  if (!payload.name) {
    alert("Preenche o nome da turma.");
    return;
  }

  if (!payload.course_id) {
    alert("Seleciona o curso.");
    return;
  }

  let error = null;

  if (id) {
    const response = await supabase
      .from("classes")
      .update(payload)
      .eq("id", id);

    error = response.error;
  } else {
    const response = await supabase
      .from("classes")
      .insert([payload]);

    error = response.error;
  }

  if (error) {
    console.error("Erro ao guardar turma:", error.message);
    alert(error.message || "Erro ao guardar turma.");
    return;
  }

  resetForm();
  hideForm();
  await fetchClasses();
}

function bindEvents() {
  const form = el("turma-form");
  const btnNova = el("btn-nova-turma");
  const btnCancelar = el("btn-cancelar-turma");
  const searchInput = el("search-turmas");

  if (form) {
    form.addEventListener("submit", save);
  }

  if (btnNova) {
    btnNova.addEventListener("click", () => {
      resetForm();
      showForm();
    });
  }

  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => {
      resetForm();
      hideForm();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.search = event.target.value || "";
      render();
    });
  }
}

export async function initClassesPage() {
  bindEvents();
  await fetchCourses();
  await fetchClasses();
}
export function initTurmasPage() {
  console.log("Turmas page carregada");

 
}
