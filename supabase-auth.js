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
  const showGate = () => { if (gate && shell) { gate.hidden = false; shell.hidden = true; } };
  const showApp = (user) => {
    if (gate && shell) { gate.hidden = true; shell.hidden = false; }
    const label = $("accountLabel");
    if (label) label.textContent = user?.email || "Cuenta";
    window.medicoreCurrentUser = user || null;
  };
  const setMode = (next) => {
    mode = next;
    const signup = next === "signup", reset = next === "reset", newPassword = next === "newpassword";
    $("authTitle").textContent = signup ? "Crear cuenta" : reset ? "Recuperar contraseña" : newPassword ? "Crear nueva contraseña" : "Inicia sesión";
    $("authIntro").textContent = signup
      ? "Crea una cuenta para mantener tus citas y avisos privados."
      : reset ? "Te enviaremos un enlace seguro para restablecer tu contraseña."
      : newPassword ? "Elige una nueva contraseña de al menos 8 caracteres."
      : "Accede a tu agenda, notificaciones y reportes privados.";
    $("authNameField").hidden = !signup;
    $("authEmailField").hidden = newPassword;
    $("authEmail").required = !newPassword;
    $("authPasswordField").hidden = reset;
    $("authPassword").required = !reset;
    $("authPassword").autocomplete = signup || newPassword ? "new-password" : "current-password";
    $("authPassword").placeholder = newPassword ? "Nueva contraseña (mínimo 8 caracteres)" : "Mínimo 8 caracteres";
    $("authPassword").value = "";
    submit.querySelector("span").textContent = signup ? "Crear cuenta" : reset ? "Enviar enlace de recuperación" : newPassword ? "Guardar contraseña nueva" : "Iniciar sesión";
    $("showSignUp").hidden = signup || reset || newPassword;
    $("showSignIn").hidden = !signup && !reset && !newPassword;
    $("showReset").hidden = reset || signup || newPassword;
    setMessage("");
  };
  const friendlyError = (error) => {
    const raw = String(error?.message || "");
    if (/invalid login credentials/i.test(raw)) return "Correo o contraseña incorrectos.";
    if (/user already registered/i.test(raw)) return "Ese correo ya tiene una cuenta. Inicia sesión.";
    if (/password should be at least/i.test(raw)) return "La contraseña debe tener al menos 8 caracteres.";
    if (/email not confirmed/i.test(raw)) return "Confirma tu correo desde el enlace que te enviamos antes de iniciar sesión.";
    if (/rate limit/i.test(raw)) return "Se alcanzó el límite temporal de intentos. Espera unos minutos e inténtalo de nuevo.";
    if (/invalid api key|invalid jwt|failed to fetch|networkerror/i.test(raw)) return "No se pudo conectar con Supabase. Verifica la URL y la clave pública del proyecto.";
    return raw || "Ocurrió un error. Inténtalo de nuevo.";
  };
  if (!window.supabase?.createClient || !config?.url || !config?.publishableKey) {
    showGate(); setMessage("Falta configurar Supabase. Revisa la URL y la clave pública en supabase-config.js."); return;
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
    const buttonText = submit.querySelector("span");
    const original = buttonText.textContent;
    buttonText.textContent = "Procesando…";
    try {
      if (mode === "signup") {
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
        const { data, error } = await client.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: location.origin + location.pathname }
        });
        if (error) throw error;
        if (data.session?.user) {
          showApp(data.session.user);
          setMessage("Cuenta creada y sesión iniciada.", true);
          location.hash = "#inicio";
          location.reload();
          return;
        }
        setMode("signin");
        setMessage("Cuenta creada. Revisa tu correo para confirmar la dirección y después inicia sesión.", true);
      } else if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + location.pathname + "?reset=1"
        });
        if (error) throw error;
        setMessage("Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.", true);
      } else if (mode === "newpassword") {
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setMode("signin");
        setMessage("Contraseña actualizada. Ya puedes iniciar sesión con la nueva contraseña.", true);
        await client.auth.signOut();
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session?.user) throw new Error("No se pudo abrir la sesión. Inténtalo de nuevo.");
        showApp(data.session.user);
        location.hash = location.hash || "#inicio";
        location.reload();
        return;
      }
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      submit.disabled = false;
      buttonText.textContent = submit.querySelector("span").textContent === "Procesando…" ? original : submit.querySelector("span").textContent;
    }
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.medicoreCurrentUser = null;
      if (gate && shell) showGate();
      return;
    }
    if (event === "PASSWORD_RECOVERY") {
      setMode("newpassword");
      setMessage("Enlace de recuperación validado. Escribe tu nueva contraseña.", true);
      showGate();
      return;
    }
    if (session?.user) {
      window.medicoreCurrentUser = session.user;
      showApp(session.user);
    }
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    const resetLink = new URLSearchParams(location.search).has("reset");
    if (resetLink && data.session?.user) {
      setMode("newpassword");
      setMessage("Enlace de recuperación detectado. Escribe tu nueva contraseña.", true);
      showGate();
    } else if (data.session?.user) {
      showApp(data.session.user);
    } else {
      showGate();
      if (resetLink) {
        setMode("reset");
        setMessage("Abre el enlace de recuperación que recibiste por correo desde este navegador.", true);
      }
    }
  }).catch((error) => { showGate(); setMessage("No se pudo comprobar la sesión: " + friendlyError(error)); });

  const signOut = $("signOutButton");
  if (signOut) signOut.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) setMessage("No se pudo cerrar sesión: " + friendlyError(error));
  });
})();