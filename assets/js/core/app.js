import { supabase } from "../config/supabase.js";
import { initDashboardPage } from "../modules/dashboard.js";
import { initStudentsPage } from "../modules/alunos.js";
import { initCoursesPage } from "../modules/cursos.js";
import { initClassesPage } from "../modules/turmas.js";

async function requireAuth() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data?.session) {
    window.location.href = "../../index.html";
    return null;
  }

  return data.session;
}

async function loadUserProfile(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  return data;
}

async function initApp() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await loadUserProfile(session.user.id);

  const userNameElement = document.getElementById("user-name");
  if (userNameElement) {
    userNameElement.textContent =
      profile?.full_name || session.user.email;
  }

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "../../index.html";
  });

  const path = window.location.pathname.toLowerCase();

  if (path.includes("dashboard.html")) {
    await initDashboardPage();
    return;
  }

  if (path.includes("alunos.html")) {
    await initStudentsPage();
    return;
  }

  if (path.includes("cursos.html")) {
    await initCoursesPage();
    return;
  }

  if (path.includes("turmas.html")) {
    await initClassesPage();
  }
}

initApp();
