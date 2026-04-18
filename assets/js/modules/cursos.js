import { supabase } from "../config/supabase.js";

const state = {
  courses: [],
};

function el(id) {
  return document.getElementById(id);
}

function clearForm() {
  const name = document.getElementById("course-name");
  const code = document.getElementById("course-code");
  const duration = document.getElementById("course-duration");
  const price = document.getElementById("course-price");
  const description = document.getElementById("course-description");

  if (name) name.value = "";
  if (code) code.value = "";
  if (duration) duration.value = "";
  if (price) price.value = "";
  if (description) description.value = "";
}

async function fetchCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar cursos:", error.message);
    return;
  }

  state.courses = data || [];
  renderCourses();
}

function renderCourses() {
  const tbody = el("cursos-body");
  if (!tbody) return;

  if (!state.courses.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">Nenhum curso encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.courses.map((course) => `
    <tr>
      <td>${course.name || ""}</td>
      <td>${course.code || ""}</td>
      <td>${course.workload_hours ?? 0}</td>
      <td>${course.duration_months ?? 0}</td>
      <td>${course.status || ""}</td>
      <td>
        <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${course.id}">Editar</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${course.id}">Eliminar</button>
      </td>
    </tr>
  `).join("");
}

function fillForm(course) {
  el("curso-id").value = course.id || "";
  el("curso-name").value = course.name || "";
  el("curso-code").value = course.code || "";
  el("curso-hours").value = course.workload_hours ?? 0;
  el("curso-months").value = course.duration_months ?? 0;
  el("curso-status").value = course.status || "active";
}

async function saveCourse(event) {
  event.preventDefault();

  const id = el("curso-id").value.trim();

  const payload = {
    name: el("curso-name").value.trim(),
    code: el("curso-code").value.trim() || null,
    workload_hours: Number(el("curso-hours").value || 0),
    duration_months: Number(el("curso-months").value || 0),
    status: el("curso-status").value,
  };

  if (!payload.name) {
    alert("O nome do curso é obrigatório.");
    return;
  }

  let error = null;

  if (id) {
    ({ error } = await supabase.from("courses").update(payload).eq("id", id));
  } else {
    ({ error } = await supabase.from("courses").insert([payload]));
  }

  if (error) {
    console.error("Erro ao guardar curso:", error.message);
    alert(error.message || "Erro ao guardar curso.");
    return;
  }

 document.addEventListener("DOMContentLoaded", () => {
  clearForm();
});
  await fetchCourses();
}

async function deleteCourse(id) {
  const confirmed = window.confirm("Deseja eliminar este curso?");
  if (!confirmed) return;

  const { error } = await supabase.from("courses").delete().eq("id", id);

  if (error) {
    console.error("Erro ao eliminar curso:", error.message);
    alert("Não foi possível eliminar o curso.");
    return;
  }

  await fetchCourses();
}

function bindEvents() {
  el("curso-form")?.addEventListener("submit", saveCourse);

  el("cursos-body")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    const course = state.courses.find((item) => item.id === id);

    if (action === "edit" && course) {
      fillForm(course);
      return;
    }

    if (action === "delete" && id) {
      await deleteCourse(id);
    }
  });
}

export async function initCoursesPage() {
  bindEvents();
  clearForm();
  await fetchCourses();
}
