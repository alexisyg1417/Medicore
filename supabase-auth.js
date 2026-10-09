(() => {
  "use strict";
  const gate = document.getElementById("authGate");
  const shell = document.getElementById("appShell");
  const form = document.getElementById("authForm");
  const message = document.getElementById("authMessage");
  const submit = document.getElementById("authSubmit");
  const setMessage = (text, ok = false) => {
    message.textContent = text;
    message.classList.toggle("success", ok);
  };
  const showGate = () => { gate.hidden = false; shell.hidden = true; };
  const showApp = (user) => {
    gate.hidden = true;
    shell.hidden = false;
    const label = document.getElementById("accountLabel");
    if (label) label.textContent = user?.email || "Cuenta";
  };
  const config = window.MEDICORE_SUPABASE_CONFIG;
  if (!window.supabase?.createClient || !config?.url || !config?.publishableKey || !config.publishableKey.startsWith("sb_publishable_")) {
    showGate();
    setMessage("Falta configurar la publishable key pública en supabase-config.js.");
    return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.medicoreSupabase = client;
  window.medicoreCurrentUser = null;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const fullName = document.getElementById("authFullName").value.trim();
    submit.disabled = true;
    setMessage("Enviando enlace seguro a tu correo…");
    try {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          data: fullName ? { full_name: fullName } : {},
          emailRedirectTo: location.origin + location.pathname,
          shouldCreateUser: true
        }
      });
      if (error) throw error;
      setMessage("Te enviamos un enlace de acceso. Revisa tu correo y abre el enlace desde este dispositivo.", true);
    } catch (error) {
      setMessage(error.message || "No se pudo enviar el enlace de acceso.");
    } finally {
      submit.disabled = false;
    }
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.medicoreCurrentUser = null;
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
    if (data.session?.user) {
      window.medicoreCurrentUser = data.session.user;
      showApp(data.session.user);
    } else showGate();
  }).catch((error) => {
    showGate();
    setMessage("No se pudo comprobar la sesión: " + error.message);
  });

  const signOut = document.getElementById("signOutButton");
  if (signOut) signOut.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) setMessage("No se pudo cerrar sesión: " + error.message);
  });
})();