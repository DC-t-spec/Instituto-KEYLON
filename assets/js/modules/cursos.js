import { supabase } from "../config/supabase.js";

const state = { courses: [] };

function el(id) {
  return document.getElementById(id);
}

async function fetchCourses() {
  const { data } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  state.courses = data || [];
  render();
}

function render() {
  const tbody = el("cursos-body");

  tbody.innerHTML = state.courses.map(c => `
    <tr>
      <td>${c.name || ""}</td>
      <td>${c.code || ""}</td>
      <td>${c.workload_hours}</td>
      <td>${c.duration_months}</td>
      <td>${c.status}</td>
      <td>
        <button onclick="editCourse('${c.id}')">✏️</button>
        <button onclick="deleteCourse('${c.id}')">🗑️</button>
      </td>
    </tr>
  `).join("");
}

window.editCourse = (id) => {
  const c = state.courses.find(x => x.id === id);

  el("curso-id").value = c.id;
  el("curso-name").value = c.name;
  el("curso-code").value = c.code;
  el("curso-hours").value = c.workload_hours;
  el("curso-months").value = c.duration_months;
  el("curso-status").value = c.status;
};

window.deleteCourse = async (id) => {
  if (!confirm("Eliminar curso?")) return;

  await supabase.from("courses").delete().eq("id", id);
  fetchCourses();
};

async function save(e) {
  e.preventDefault();

  const id = el("curso-id").value;

  const payload = {
    name: el("curso-name").value,
    code: el("curso-code").value || null,
    workload_hours: Number(el("curso-hours").value || 0),
    duration_months: Number(el("curso-months").value || 0),
    status: el("curso-status").value
  };

  if (id) {
    await supabase.from("courses").update(payload).eq("id", id);
  } else {
    await supabase.from("courses").insert([payload]);
  }

  e.target.reset();
  fetchCourses();
}

export async function initCoursesPage() {
  el("curso-form").addEventListener("submit", save);
  await fetchCourses();
}
