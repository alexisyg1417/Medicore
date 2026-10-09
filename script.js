/* =========================
   MENÚ RESPONSIVO
========================= */
(() => {
  const menuButton = document.getElementById("menuButton");
  const navMenu = document.getElementById("navMenu");
  if (!menuButton || !navMenu) return;

  const setMenu = (open) => {
    navMenu.classList.toggle("active", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    menuButton.textContent = open ? "✕" : "☰";
  };

  menuButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu(!navMenu.classList.contains("active"));
  });
  navMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("click", (event) => {
    if (!navMenu.contains(event.target) && !menuButton.contains(event.target)) setMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { setMenu(false); menuButton.focus(); }
  });
  window.addEventListener("resize", () => { if (window.innerWidth > 760) setMenu(false); });
})();
/* =========================
   INSTALACIÓN PWA
========================= */
let deferredPrompt = null;
const installButton = document.getElementById("installButton");

if (installButton) {
  // Solo mostramos el botón cuando el navegador confirma que se puede instalar.
  installButton.hidden = true;
  installButton.style.display = "none";

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
    installButton.style.display = "inline-block";
  });

  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.hidden = true;
    installButton.style.display = "none";
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installButton.hidden = true;
    installButton.style.display = "none";
    console.info("MediCore se instaló correctamente.");
  });
}

/* =========================
   SERVICE WORKER
========================= */
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", {
        scope: "./"
      });
      console.info("Service Worker de MediCore registrado.", registration.scope);
    } catch (error) {
      console.error("No se pudo registrar el Service Worker de MediCore:", error);
    }
  });
}


/* =========================
   NOTIFICACIONES DE PRUEBA
========================= */
(() => {
  const button = document.getElementById("notificationButton");
  const status = document.getElementById("notificationStatus");
  if (!button || !status) return;

  const message = (text) => { status.textContent = text; };
  const supported = ("Notification" in window);
  if (!supported) {
    button.disabled = true;
    message("Este navegador no admite notificaciones web. Prueba con Chrome o Edge actualizado.");
    return;
  }
  if (!window.isSecureContext) {
    button.disabled = true;
    message("Las notificaciones requieren HTTPS. Abre MediCore desde su dirección segura.");
    return;
  }
  if (Notification.permission === "granted") {
    button.textContent = "🔔 Enviar notificación de prueba";
    message("Permiso concedido. Pulsa para recibir un aviso de prueba.");
  } else if (Notification.permission === "denied") {
    message("Las notificaciones están bloqueadas en los permisos del navegador. Habilítalas para este sitio y recarga.");
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        message(permission === "denied"
          ? "Permiso denegado. Activa las notificaciones en los ajustes del sitio y vuelve a intentarlo."
          : "No se concedió permiso. Puedes volver a intentarlo cuando quieras.");
        return;
      }

      const options = {
        body: "¡Todo listo! MediCore puede mostrar avisos en este dispositivo.",
        icon: "./icons/medicore-icon.svg",
        badge: "./icons/medicore-icon.svg",
        tag: "medicore-test-notification",
        data: { url: "./panel.html" }
      };
      let shown = false;
      if ("serviceWorker" in navigator) {
        try {
          const registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Service Worker tardó demasiado")), 5000))
          ]);
          if (registration && registration.showNotification) {
            await registration.showNotification("MediCore · Notificación de prueba", options);
            shown = true;
          }
        } catch (error) {
          console.warn("Se usará el método alternativo de notificación:", error);
        }
      }
      if (!shown) {
        try {
          const notification = new Notification("MediCore · Notificación de prueba", options);
          notification.onclick = () => { window.focus(); window.location.href = "./panel.html"; };
          shown = true;
        } catch (error) {
          console.error("El navegador no pudo mostrar la notificación:", error);
        }
      }
      if (shown) {
        button.textContent = "🔔 Enviar otra notificación";
        message("¡Notificación enviada! Si no aparece, revisa el permiso de notificaciones del dispositivo.");
      } else {
        message("El navegador concedió permiso, pero no pudo mostrar el aviso. Revisa los ajustes de notificaciones del sistema.");
      }
    } catch (error) {
      console.error("Error al activar notificaciones:", error);
      message("Ocurrió un error al mostrar el aviso. Recarga la página e inténtalo de nuevo.");
    } finally {
      button.disabled = false;
    }
  });
})();

/* =========================
   SIMULADOR DEL MODELO DE SUSCRIPCIÓN
   Escenario ilustrativo para explicar el modelo de negocio.
========================= */
const clinicRange = document.getElementById("clinicRange");
const clinicCountLabel = document.getElementById("clinicCountLabel");
const priceSelect = document.getElementById("priceSelect");
const monthlyRevenue = document.getElementById("monthlyRevenue");
const annualRevenue = document.getElementById("annualRevenue");
const clientSummary = document.getElementById("clientSummary");
const simulatorInsight = document.getElementById("simulatorInsight");
const growthBar = document.getElementById("growthBar");

if (clinicRange && clinicCountLabel && priceSelect && monthlyRevenue && annualRevenue && clientSummary && simulatorInsight && growthBar) {
  const mxn = (amount) => new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0
  }).format(amount);

  const updateSimulator = () => {
    const clinics = Math.min(200, Math.max(1, Number.parseInt(clinicRange.value, 10) || 1));
    const monthlyFee = Math.min(10000, Math.max(0, Number.parseInt(priceSelect.value, 10) || 0));
    const monthly = clinics * monthlyFee;
    const annual = monthly * 12;

    clinicCountLabel.value = String(clinics);
    clinicCountLabel.textContent = String(clinics);
    monthlyRevenue.innerHTML = `${mxn(monthly)} <small>MXN</small>`;
    annualRevenue.textContent = `${mxn(annual)} MXN`;
    clientSummary.textContent = `${clinics} ${clinics === 1 ? "consultorio" : "consultorios"}`;
    growthBar.style.width = `${Math.min(100, (clinics / 200) * 100)}%`;
    simulatorInsight.textContent = `Con ${clinics} ${clinics === 1 ? "consultorio" : "consultorios"} y una cuota ilustrativa de ${mxn(monthlyFee)} MXN al mes, el ingreso bruto estimado sería de ${mxn(monthly)} MXN mensuales, antes de gastos e impuestos.`;
  };

  clinicRange.addEventListener("input", updateSimulator);
  priceSelect.addEventListener("change", updateSimulator);
  updateSimulator();
}
