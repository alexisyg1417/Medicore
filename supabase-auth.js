(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const gate = $("authGate"), shell = $("appShell"), form = $("authForm");
  const message = $("authMessage"), submit = $("authSubmit");
  const config = window.MEDICORE_SUPABASE_CONFIG;
  let mode = "signin";
  const setMessage = (text, ok = false) => {
    message.textContent = text;
    message.classList.toggle("success", ok);
  };
  const showGate = () => { gate.hidden = false; shell.hidden = true; };
  const showApp = (user) => {
    gate.hidden = true; shell.hidden = false;
    const label = $("accountLabel");
    if (label) label.textContent = user?.email || "Cuenta";
    window.medicoreCurrentUser = user || null;
  };
  const setMode = (next) => {
    mode = next;
    const reset = next === "reset";
    const signup = next === "signup";
    $("authTitle").textContent = reset ? "Recuperar contraseña" : signup ? "Crear cuenta" : "Inicia sesión";
    $("authIntro").textContent = reset
      ? "Te enviaremos un enlace para restablecer tu contraseña."
      : signup ? "Registra tu correo y crea una contraseña segura para tu espacio privado."
      : "Accede a tu agenda, notificaciones y reportes privados.";
    $("authNameField").hidden = !signup;
    $("authPasswordField").hidden = reset;
    $("authPassword").required = !reset;
    $("authPassword").autocomplete = signup ? "new-password" : "current-password";
    $("authPassword").value = "";
    submit.querySelector("span").textContent = reset ? "Enviar enlace de recuperación" : signup ? "Crear cuenta" : "Iniciar sesión";
    $("showSignUp").hidden = signup || reset;
    $("showSignIn").hidden = !signup && !reset;
    $("showReset").hidden = reset || signup;
    setMessage("");
  };
  const friendlyError = (error) => {
    const raw = String(error?.message || "");
    if (/invalid login credentials/i.test(raw)) return "Correo o contraseña incorrectos.";
    if (/user already registered/i.test(raw)) return "Ese correo ya tiene una cuenta. Inicia sesión.";
    if (/password should be at least/i.test(raw)) return "La contraseña debe tener al menos 8 caracteres.";
    if (/email not confirmed/i.test(raw)) return "Confirma tu correo desde el enlace que te enviamos antes de iniciar sesión.";
    if (/rate limit/i.test(raw)) return "Se alcanzó el límite temporal de intentos. Espera unos minutos e inténtalo de nuevo.";
    return raw || "Ocurrió un error. Inténtalo de nuevo.";
  };
  if (!window.supabase?.createClient || !config?.url || !config?.publishableKey) {
    showGate(); setMessage("Falta configurar Supabase. Revisa supabase-config.js y la URL/clave pública del proyecto."); return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.medicoreSupabase = client;
  window.medicoreCurrentUser = null;

  $("showSignUp").addEventListener("click", () => setMode("signup"));
  $("showSignIn").addEventListener("click", () => setMode("signin"));
  $("showReset").addEventListener("click", () => setMode("reset"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("authEmail").value.trim().toLowerCase();
    const password = $("authPassword").value;
    const fullName = $("authFullName").value.trim();
    submit.disabled = true;
    const original = submit.querySelector("span").textContent;
    submit.querySelector("span").textContent = "Procesando…";
    try {
      if (mode === "signup") {
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
        const { data, error } = await client.auth.signUp({
          email, password, options: { data: { full_name: fullName }, emailRedirectTo: location.origin + location.pathname }
        });
        if (error) throw error;
        if (data.session?.user) {
          showApp(data.session.user);
          setMessage("Cuenta creada y sesión iniciada.", true);
          setTimeout(() => location.reload(), 350);
        } else {
          setMessage("Cuenta creada. Revisa tu correo y confirma la dirección antes de iniciar sesión.", true);
          setMode("signin");
          setMessage("Cuenta creada. Revisa tu correo para confirmarla; después inicia sesión.", true);
        }
      } else if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "?reset=1" });
        if (error) throw error;
        setMessage("Si el correo está registrado, recibirás un enlace para restablecer la contraseña.", true);
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session?.user) throw new Error("No se pudo abrir la sesión. Inténtalo de nuevo.");
        showApp(data.session.user);
        setMessage("Sesión iniciada.", true);
        location.hash = location.hash || "#inicio";
        setTimeout(() => location.reload(), 150);
      }
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      submit.disabled = false;
      submit.querySelector("span").textContent = original;
      if (mode !== "reset" && mode !== "signup") submit.querySelector("span").textContent = "Iniciar sesión";
    }
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.medicoreCurrentUser = null; showGate(); return;
    }
    if (session?.user) {
      window.medicoreCurrentUser = session.user;
      showApp(session.user);
    }
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    if (data.session?.user) {
      showApp(data.session.user);
      if (new URLSearchParams(location.search).has("reset")) setMessage("Ya puedes iniciar sesión. Si llegaste desde un enlace de recuperación, define tu nueva contraseña en la pantalla de recuperación de Supabase.", true);
    } else showGate();
  }).catch((error) => { showGate(); setMessage("No se pudo comprobar la sesión: " + friendlyError(error)); });

  const signOut = $("signOutButton");
  if (signOut) signOut.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) setMessage("No se pudo cerrar sesión: " + friendlyError(error));
  });
  if (new URLSearchParams(location.search).has("reset")) {
    setMode("reset");
    setMessage("Escribe tu correo para solicitar un enlace de recuperación.", true);
  }
})();