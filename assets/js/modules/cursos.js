import { supabase } from "../config/supabase.js";

const state = {
  cursos: [],
  filteredCursos: [],
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

function resetCourseForm() {
  el("curso-id").value = "";
  el("curso-nome").value = "";
  el("curso-codigo").value = "";
  el("curso-descricao").value = "";
  el("curso-carga-horaria").value = "0";
  el("curso-duracao-meses").value = "0";
  el("curso-status").value = "ativo";
}

function showCourseForm() {
  el("curso-form-container")?.classList.remove("hidden");
}

function hideCourseForm() {
  el("curso-form-container")?.classList.add("hidden");
  resetCourseForm();
}

function fillCourseForm(curso) {
  el("curso-id").value = curso.id ?? "";
  el("curso-nome").value = curso.nome ?? "";
  el("curso-codigo").value = curso.codigo ?? "";
  el("curso-descricao").value = curso.descricao ?? "";
  el("curso-carga-horaria").value = curso.carga_horaria ?? 0;
  el("curso-duracao-meses").value = curso.duracao_meses ?? 0;
  el("curso-status").value = curso.status ?? "ativo";
  showCourseForm();
}

async function fetchCourses() {
  const { data, error } = await supabase
    .from("cursos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar cursos:", error.message);
    alert("Erro ao carregar cursos.");
    return;
  }

  state.cursos = data || [];
  state.filteredCursos = [...state.cursos];
  renderCoursesTable();
}

function renderCoursesTable() {
  const tbody = el("cursos-table-body");
  if (!tbody) return;

  if (!state.filteredCursos.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">Nenhum curso encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.filteredCursos
    .map(
      (curso) => `
        <tr>
          <td>${escapeHtml(curso.nome)}</td>
          <td>${escapeHtml(curso.codigo || "-")}</td>
          <td>${escapeHtml(curso.carga_horaria)}</td>
          <td>${escapeHtml(curso.duracao_meses)}</td>
          <td>${escapeHtml(curso.status)}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${curso.id}">Editar</button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${curso.id}">Eliminar</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function filterCourses(term) {
  const query = term.trim().toLowerCase();

  if (!query) {
    state.filteredCursos = [...state.cursos];
  } else {
    state.filteredCursos = state.cursos.filter((curso) => {
      return (
        (curso.nome || "").toLowerCase().includes(query) ||
        (curso.codigo || "").toLowerCase().includes(query) ||
        (curso.status || "").toLowerCase().includes(query)
      );
    });
  }

  renderCoursesTable();
}

async function saveCourse(event) {
  event.preventDefault();

  const id = el("curso-id").value.trim();
  const nome = el("curso-nome").value.trim();
  const codigo = el("curso-codigo").value.trim();
  const descricao = el("curso-descricao").value.trim();
  const cargaHoraria = Number(el("curso-carga-horaria").value || 0);
  const duracaoMeses = Number(el("curso-duracao-meses").value || 0);
  const status = el("curso-status").value;

  if (!nome) {
    alert("O nome do curso é obrigatório.");
    return;
  }

  const payload = {
    nome,
    codigo: codigo || null,
    descricao: descricao || null,
    carga_horaria: Number.isNaN(cargaHoraria) ? 0 : cargaHoraria,
    duracao_meses: Number.isNaN(duracaoMeses) ? 0 : duracaoMeses,
    status,
  };

  let error;

  if (id) {
    ({ error } = await supabase.from("cursos").update(payload).eq("id", id));
  } else {
    ({ error } = await supabase.from("cursos").insert([payload]));
  }

  if (error) {
    console.error("Erro ao guardar curso:", error.message);
    alert(error.message || "Erro ao guardar curso.");
    return;
  }

  hideCourseForm();
  await fetchCourses();
}

async function deleteCourse(id) {
  const confirmed = window.confirm("Deseja eliminar este curso?");
  if (!confirmed) return;

  const { error } = await supabase.from("cursos").delete().eq("id", id);

  if (error) {
    console.error("Erro ao eliminar curso:", error.message);
    alert("Não foi possível eliminar este curso. Verifica se ele está ligado a turmas.");
    return;
  }

  await fetchCourses();
}

function bindCourseEvents() {
  el("btn-novo-curso")?.addEventListener("click", () => {
    resetCourseForm();
    showCourseForm();
  });

  el("btn-cancelar-curso")?.addEventListener("click", () => {
    hideCourseForm();
  });

  el("curso-form")?.addEventListener("submit", saveCourse);

  el("search-cursos")?.addEventListener("input", (event) => {
    filterCourses(event.target.value);
  });

  el("cursos-table-body")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const curso = state.cursos.find((item) => item.id === id);

    if (action === "edit" && curso) {
      fillCourseForm(curso);
      return;
    }

    if (action === "delete" && id) {
      await deleteCourse(id);
    }
  });
}

export async function initCoursesPage() {
  bindCourseEvents();
  await fetchCourses();
}
