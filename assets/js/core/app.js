import { supabase } from "../config/supabase.js";
import { initDashboardPage } from "../modules/dashboard.js";
import { initStudentsPage } from "../modules/alunos.js";
import { initCoursesPage } from "../modules/cursos.js";
import { initClassesPage } from "../modules/turmas.js";

async function requireAuth() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Erro ao verificar sessão:", error.message);
    window.location.href = "./index.html";
    return null;
  }

  if (!data?.session) {
    window.location.href = "./index.html";
    return null;
  }

  return data.session;
}

async function loadUserProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar perfil:", error.message);
    return null;
  }

  return data;
}

async function initApp() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await loadUserProfile(session.user.id);
  const userNameElement = document.getElementById("user-name");

  if (userNameElement) {
    userNameElement.textContent =
      profile?.full_name?.trim() || session.user.email || "Utilizador";
  }

  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "./index.html";
  });

  const path = window.location.pathname;

  if (path.includes("dashboard.html")) {
    await initDashboardPage();
  }

  if (path.includes("alunos.html")) {
    await initStudentsPage(session.user.id);
  }

  if (path.includes("cursos.html")) {
    await initCoursesPage(session.user.id);
  }

  if (path.includes("turmas.html")) {
    await initClassesPage(session.user.id);
  }
}

initApp();
