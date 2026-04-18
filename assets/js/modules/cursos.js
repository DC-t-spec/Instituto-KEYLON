import { supabase } from "../config/supabase.js";

const state = {
  courses: [],
  editingId: null,
};

function el(id) {
  return document.getElementById(id);
}

function clearForm() {
  state.editingId = null;

  const name = el("course-name");
  const code = el("course-code");
  const duration = el("course-duration");
  const price = el("course-price");
  const description = el("course-description");

  if (name) name.value = "";
  if (code) code.value = "";
  if (duration) duration.value = "";
  if (price) price.value = "";
  if (description) description.value = "";
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-MZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

async function fetchCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar cursos:", error);
    state.courses = [];
    renderCourses();
    return;
  }

  state.courses = data || [];
  renderCourses();
}

function renderCourses() {
  const tbody = el("coursesTableBody");
  if (!tbody) return;

  if (!state.courses.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">Nenhum curso encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.courses
    .map((course) => {
      return `
        <tr>
          <td>${course.name || "-"}</td>
          <td>${course.code || "-"}</td>
          <td>${course.duration_months ?? 0}</td>
          <td>${formatMoney(course.monthly_fee ?? course.fee_enrollment ?? course.fee_registration ?? 0)}</td>
          <td>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              data-action="edit"
              data-id="${course.id}"
            >
              Editar
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              data-action="delete"
              data-id="${course.id}"
            >
              Eliminar
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function fillForm(course) {
  state.editingId = course.id || null;

  const name = el("course-name");
  const code = el("course-code");
  const duration = el("course-duration");
  const price = el("course-price");
  const description = el("course-description");

  if (name) name.value = course.name || "";
  if (code) code.value = course.code || "";
  if (duration) duration.value = course.duration_months ?? "";
  if (price) price.value =
    course.monthly_fee ??
    course.fee_enrollment ??
    course.fee_registration ??
    "";
  if (description) description.value = course.description || "";
}

async function saveCourse(event) {
  event.preventDefault();

  const name = el("course-name")?.value?.trim() || "";
  const code = el("course-code")?.value?.trim() || "";
  const duration = el("course-duration")?.value || "";
  const price = el("course-price")?.value || "";
  const description = el("course-description")?.value?.trim() || "";

  if (!name) {
    alert("O nome do curso é obrigatório.");
    return;
  }

  const payload = {
    name,
    code: code || null,
    duration_months: duration ? Number(duration) : null,
    description: description || null,
    monthly_fee: price ? Number(price) : 0,
  };

  let error = null;

  if (state.editingId) {
    ({ error } = await supabase
      .from("courses")
      .update(payload)
      .eq("id", state.editingId));
  } else {
    ({ error } = await supabase.from("courses").insert([payload]));
  }

  if (error) {
    console.error("Erro ao guardar curso:", error);
    alert(error.message || "Erro ao guardar curso.");
    return;
  }

  clearForm();
  await fetchCourses();
}

async function deleteCourse(id) {
  const confirmed = window.confirm("Deseja eliminar este curso?");
  if (!confirmed) return;

  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao eliminar curso:", error);
    alert(error.message || "Não foi possível eliminar o curso.");
    return;
  }

  await fetchCourses();
}

function bindEvents() {
  el("courseForm")?.addEventListener("submit", saveCourse);

  el("course-reset-btn")?.addEventListener("click", () => {
    clearForm();
  });

  el("coursesTableBody")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
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

  el("courseSearch")?.addEventListener("input", (event) => {
    const term = (event.target.value || "").trim().toLowerCase();
    const tbody = el("coursesTableBody");
    if (!tbody) return;

    const filtered = state.courses.filter((course) => {
      return (
        (course.name || "").toLowerCase().includes(term) ||
        (course.code || "").toLowerCase().includes(term) ||
        (course.description || "").toLowerCase().includes(term)
      );
    });

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-cell">Nenhum curso encontrado.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered
      .map((course) => {
        return `
          <tr>
            <td>${course.name || "-"}</td>
            <td>${course.code || "-"}</td>
            <td>${course.duration_months ?? 0}</td>
            <td>${formatMoney(course.monthly_fee ?? course.fee_enrollment ?? course.fee_registration ?? 0)}</td>
            <td>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-action="edit"
                data-id="${course.id}"
              >
                Editar
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                data-action="delete"
                data-id="${course.id}"
              >
                Eliminar
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  });
}

export async function initCoursesPage() {
  bindEvents();
  clearForm();
  await fetchCourses();
}
