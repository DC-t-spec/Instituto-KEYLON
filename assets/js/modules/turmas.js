import { supabase } from "../config/supabase.js";

const state = { classes: [], courses: [] };

function el(id) {
  return document.getElementById(id);
}

async function fetchCourses() {
  const { data } = await supabase.from("courses").select("id, name");
  state.courses = data || [];

  el("class-course").innerHTML = `
    <option value="">Selecionar curso</option>
    ${state.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}
  `;
}

async function fetchClasses() {
  const { data } = await supabase
    .from("classes")
    .select("*, courses(name)")
    .order("created_at", { ascending: false });

  state.classes = data || [];
  render();
}

function render() {
  const tbody = el("turmas-body");

  tbody.innerHTML = state.classes.map(t => `
    <tr>
      <td>${t.name}</td>
      <td>${t.courses?.name || "-"}</td>
      <td>${t.period || "-"}</td>
      <td>${t.year || "-"}</td>
      <td>${t.status}</td>
      <td>
        <button onclick="editClass('${t.id}')">✏️</button>
        <button onclick="deleteClass('${t.id}')">🗑️</button>
      </td>
    </tr>
  `).join("");
}

window.editClass = (id) => {
  const t = state.classes.find(x => x.id === id);

  el("class-id").value = t.id;
  el("class-name").value = t.name;
  el("class-course").value = t.course_id;
};

window.deleteClass = async (id) => {
  if (!confirm("Eliminar turma?")) return;

  await supabase.from("classes").delete().eq("id", id);
  fetchClasses();
};

async function save(e) {
  e.preventDefault();

  const id = el("class-id").value;

  const payload = {
    name: el("class-name").value,
    course_id: el("class-course").value,
    status: "active"
  };

  if (id) {
    await supabase.from("classes").update(payload).eq("id", id);
  } else {
    await supabase.from("classes").insert([payload]);
  }

  e.target.reset();
  fetchClasses();
}

export async function initClassesPage() {
  el("turma-form").addEventListener("submit", save);
  await fetchCourses();
  await fetchClasses();
}
