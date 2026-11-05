import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const authDialog = document.getElementById("auth-dialog");
const btnLogin = document.getElementById("btn-login");
const btnRegister = document.getElementById("btn-register");
const btnLogout = document.getElementById("btn-logout");
const authDialogClose = document.getElementById("auth-dialog-close");
const userMenu = document.getElementById("user-menu");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const authContainer = document.getElementById("auth-container");

// Tabs
const tabLogin = document.querySelector('[data-tab="login"]');
const tabRegister = document.querySelector('[data-tab="register"]');
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");

// ── 1. Modal Controls ──
btnLogin?.addEventListener("click", () => {
  switchTab("login");
  authDialog.showModal();
});

btnRegister?.addEventListener("click", () => {
  switchTab("register");
  authDialog.showModal();
});

authDialogClose?.addEventListener("click", () => authDialog.close());
authDialog?.addEventListener("click", (e) => {
  if (e.target === authDialog) authDialog.close(); // Close on backdrop click
});

function switchTab(tab) {
  if (tab === "login") {
    tabLogin.setAttribute("aria-selected", "true");
    tabLogin.classList.add("bg-[var(--accent)]", "text-[var(--bg-primary)]");
    tabRegister.setAttribute("aria-selected", "false");
    tabRegister.classList.remove("bg-[var(--accent)]", "text-[var(--bg-primary)]");
    formLogin.classList.remove("hidden");
    formRegister.classList.add("hidden");
  } else {
    tabRegister.setAttribute("aria-selected", "true");
    tabRegister.classList.add("bg-[var(--accent)]", "text-[var(--bg-primary)]");
    tabLogin.setAttribute("aria-selected", "false");
    tabLogin.classList.remove("bg-[var(--accent)]", "text-[var(--bg-primary)]");
    formRegister.classList.remove("hidden");
    formLogin.classList.add("hidden");
  }
}

// ── 2. Auth Handlers ──
formRegister?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(formRegister);
  const email = formData.get("email");
  const password = formData.get("password");
  const fullName = formData.get("full_name");
  const jobTitle = formData.get("job_title");
  const phone = formData.get("phone");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, job_title: jobTitle, phone },
    },
  });

  if (error) {
    document.getElementById("register-error").textContent = error.message;
    document.getElementById("register-error").classList.remove("hidden");
  } else {
    document.getElementById("register-error").classList.add("hidden");
    const successMsg = document.getElementById("register-success");
    successMsg.textContent = "Account created! Please check your email to confirm.";
    successMsg.classList.remove("hidden");
    setTimeout(() => authDialog.close(), 3000);
  }
});

formLogin?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(formLogin);
  const email = formData.get("email");
  const password = formData.get("password");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    document.getElementById("login-error").textContent = error.message;
    document.getElementById("login-error").classList.remove("hidden");
  } else {
    document.getElementById("login-error").classList.add("hidden");
    authDialog.close();
    updateUI(data.user);
  }
});

btnLogout?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  updateUI(null);
});

// ── 3. Session Management ──
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    updateUI(session.user);
  }
}

function updateUI(user) {
  if (user) {
    // Show user menu, hide login/register buttons
    document.getElementById("btn-login").classList.add("hidden");
    document.getElementById("btn-register").classList.add("hidden");
    userMenu.classList.remove("hidden");
    userMenu.classList.add("flex");
    
    userName.textContent = user.user_metadata?.full_name || user.email.split("@")[0];
    userAvatar.src = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || "User")}&background=38bdf8&color=fff`;
    
    // Unlock gated content (e.g., remove blur from services)
    const gateOverlay = document.getElementById("gate-overlay");
    const servicesGrid = document.getElementById("services-grid");
    if (gateOverlay) gateOverlay.classList.add("hidden");
    if (servicesGrid) servicesGrid.classList.remove("blur-sm");
  } else {
    // Show login/register, hide user menu
    document.getElementById("btn-login").classList.remove("hidden");
    document.getElementById("btn-register").classList.remove("hidden");
    userMenu.classList.add("hidden");
    userMenu.classList.remove("flex");
    
    // Re-lock gated content
    const gateOverlay = document.getElementById("gate-overlay");
    const servicesGrid = document.getElementById("services-grid");
    if (gateOverlay) gateOverlay.classList.remove("hidden");
    if (servicesGrid) servicesGrid.classList.add("blur-sm");
  }
}

// Listen for auth state changes (e.g., email confirmation, logout from another tab)
supabase.auth.onAuthStateChange((event, session) => {
  updateUI(session?.user || null);
});

// Initialize on load
checkSession();
