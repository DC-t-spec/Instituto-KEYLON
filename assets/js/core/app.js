import { supabase } from "../config/supabase.js";

import { initDashboardPage } from "../modules/dashboard.js";
import { initStudentsPage } from "../modules/alunos.js";
import { initCoursesPage } from "../modules/cursos.js";
import { initTurmasPage } from "../modules/turmas.js";
import { initChargesPage } from "../modules/cobrancas.js";
import { initPaymentsPage } from "../modules/pagamentos.js";
import { initDividas } from "../modules/dividas.js";

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
      profile?.full_name?.trim() ||
      session.user.email ||
      "Utilizador";
  }

  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "./index.html";
  });

  const path = window.location.pathname.toLowerCase();

  // ROUTER SIMPLES
  if (path.includes("dashboard.html")) return initDashboardPage();

  if (path.includes("alunos.html")) return initStudentsPage();

  if (path.includes("cursos.html")) return initCoursesPage();

  if (path.includes("turmas.html")) return initTurmasPage();

  if (path.includes("cobrancas.html")) return initChargesPage();

  if (path.includes("pagamentos.html")) return initPaymentsPage();

  if (path.includes("dividas.html")) return initDividas();
}

initApp();
