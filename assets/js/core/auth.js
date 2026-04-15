import { supabase } from "../config/supabase.js";

const loginForm = document.getElementById("login-form");
const authMessage = document.getElementById("auth-message");

async function redirectIfLoggedIn() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Erro ao verificar sessão:", error.message);
    return;
  }

  if (data?.session) {
    window.location.href = "./dashboard.html";
  }
}

redirectIfLoggedIn();

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  authMessage.textContent = "";

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!email || !password) {
    authMessage.textContent = "Preencha o email e a palavra-passe.";
    return;
  }

  const button = loginForm.querySelector("button[type='submit']");
  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = "A entrar...";

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      authMessage.textContent = error.message;
      return;
    }

    window.location.href = "./dashboard.html";
  } catch (err) {
    console.error(err);
    authMessage.textContent = "Não foi possível iniciar sessão.";
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
