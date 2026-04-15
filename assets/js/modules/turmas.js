import { supabase } from "../config/supabase.js";

const state = {
  turmas: [],
  cursos: [],
  filteredTurmas: [],
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

function resetClassForm() {
  el("turma-id").value = "";
  el("turma-curso-id").value = "";
  el("turma-nome").value = "";
  el("turma-codigo").value = "";
  el("turma-periodo").value = "";
  el("turma-ano").value = "";
  el("turma-data-inicio").value = "";
  el("turma-data-fim").value = "";
  el("turma-capacidade").value = "0";
  el("turma-status").value = "ativa";
}

function showClassForm() {
  el("turma-form-container")?.classList.remove("hidden");
}

function hideClassForm() {
  el("turma-form-container")?.classList.add("hidden");
  resetClassForm();
}

function fillClassForm(turma) {
  el("turma-id").value = turma.id ?? "";
  el("turma-curso-id").value = turma.curso_id ?? "";
  el("turma-nome").value = turma.nome ?? "";
  el("turma-codigo").value = turma.codigo ?? "";
  el("turma-periodo").value = turma.periodo ?? "";
  el("turma-ano").value = turma.ano ?? "";
  el("turma-data-inicio").value = turma.data_inicio ?? "";
  el("turma-data-fim").value = turma.data_fim ?? "";
  el("turma-capacidade").value = turma.capacidade ?? 0;
  el("turma-status").value = turma.status ?? "ativa";
  showClassForm();
}

async function fetchCoursesForSelect() {
  const { data, error } = await supabase
    .from("cursos")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar cursos:", error.message);
    alert("Erro ao carregar cursos para a turma.");
    return;
  }

  state.cursos = data || [];
  renderCourseOptions();
}

function renderCourseOptions() {
  const select = el("turma-curso-id");
  if (!select) return;

  select.innerHTML = `
    <option value="">Selecionar curso</option>
    ${state.cursos
      .map(
        (curso) =>
          `<option value="${curso.id}">${escapeHtml(curso.nome)}</option>`
      )
      .join("")}
  `;
}

async function fetchClasses() {
  const { data, error } = await supabase
    .from("turmas")
    .select(`
      id,
      curso_id,
      nome,
      codigo,
      periodo,
      ano,
      data_inicio,
      data_fim,
      capacidade,
      status,
      created_at,
      cursos (
        id,
        nome
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar turmas:", error.message);
    alert("Erro ao carregar turmas.");
    return;
  }

  state.turmas = data || [];
  state.filteredTurmas = [...state.turmas];
  renderClassesTable();
}

function renderClassesTable() {
  const tbody = el("turmas-table-body");
  if (!tbody) return;

  if (!state.filteredTurmas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">Nenhuma turma encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.filteredTurmas
    .map(
      (turma) => `
        <tr>
          <td>${escapeHtml(turma.nome)}</td>
          <td>${escapeHtml(turma.cursos?.nome || "-")}</td>
          <td>${escapeHtml(turma.periodo || "-")}</td>
          <td>${escapeHtml(turma.ano || "-")}</td>
          <td>${escapeHtml(turma.capacidade)}</td>
          <td>${escapeHtml(turma.status)}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${turma.id}">Editar</button>
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${turma.id}">Eliminar</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function filterClasses(term) {
  const query = term.trim().toLowerCase();

  if (!query) {
    state.filteredTurmas = [...state.turmas];
  } else {
    state.filteredTurmas = state.turmas.filter((turma) => {
      return (
        (turma.nome || "").toLowerCase().includes(query) ||
        (turma.codigo || "").toLowerCase().includes(query) ||
        (turma.periodo || "").toLowerCase().includes(query) ||
        (turma.status || "").toLowerCase().includes(query) ||
        (turma.cursos?.nome || "").toLowerCase().includes(query)
      );
    });
  }

  renderClassesTable();
}

async function saveClass(event) {
  event.preventDefault();

  const id = el("turma-id").value.trim();
  const cursoId = el("turma-curso-id").value;
  const nome = el("turma-nome").value.trim();
  const codigo = el("turma-codigo").value.trim();
  const periodo = el("turma-periodo").value.trim();
  const ano = el("turma-ano").value ? Number(el("turma-ano").value) : null;
  const dataInicio = el("turma-data-inicio").value || null;
  const dataFim = el("turma-data-fim").value || null;
  const capacidade = Number(el("turma-capacidade").value || 0);
  const status = el("turma-status").value;

  if (!cursoId) {
    alert("Seleciona um curso.");
    return;
  }

  if (!nome) {
    alert("O nome da turma é obrigatório.");
    return;
  }

  const payload = {
    curso_id: cursoId,
    nome,
    codigo: codigo || null,
    periodo: periodo || null,
    ano: Number.isNaN(ano) ? null : ano,
    data_inicio: dataInicio,
    data_fim: dataFim,
    capacidade: Number.isNaN(capacidade) ? 0 : capacidade,
    status,
  };

  let error;

  if (id) {
    ({ error } = await supabase.from("turmas").update(payload).eq("id", id));
  } else {
    ({ error } = await supabase.from("turmas").insert([payload]));
  }

  if (error) {
    console.error("Erro ao guardar turma:", error.message);
    alert(error.message || "Erro ao guardar turma.");
    return;
  }

  hideClassForm();
  await fetchClasses();
}

async function deleteClass(id) {
  const confirmed = window.confirm("Deseja eliminar esta turma?");
  if (!confirmed) return;

  const { error } = await supabase.from("turmas").delete().eq("id", id);

  if (error) {
    console.error("Erro ao eliminar turma:", error.message);
    alert("Não foi possível eliminar esta turma.");
    return;
  }

  await fetchClasses();
}

function bindClassEvents() {
  el("btn-nova-turma")?.addEventListener("click", () => {
    resetClassForm();
    showClassForm();
  });

  el("btn-cancelar-turma")?.addEventListener("click", () => {
    hideClassForm();
  });

  el("turma-form")?.addEventListener("submit", saveClass);

  el("search-turmas")?.addEventListener("input", (event) => {
    filterClasses(event.target.value);
  });

  el("turmas-table-body")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const turma = state.turmas.find((item) => item.id === id);

    if (action === "edit" && turma) {
      fillClassForm(turma);
      return;
    }

    if (action === "delete" && id) {
      await deleteClass(id);
    }
  });
}

export async function initClassesPage() {
  bindClassEvents();
  await fetchCoursesForSelect();
  await fetchClasses();
}
