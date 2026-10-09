/* =========================
   MENÚ MÓVIL
========================= */
const menuButton = document.getElementById("menuButton");
const navMenu = document.getElementById("navMenu");

if (menuButton && navMenu) {
  menuButton.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("active");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  });

  navMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("active");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Abrir menú");
    });
  });
}

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
   NOTIFICACIONES DEL NAVEGADOR
   Muestra una notificación de prueba después de que el usuario lo autorice.
========================= */
const notificationButton = document.getElementById("notificationButton");
const notificationStatus = document.getElementById("notificationStatus");

if (notificationButton && notificationStatus) {
  const setNotificationStatus = (message) => {
    notificationStatus.textContent = message;
  };

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    notificationButton.disabled = true;
    setNotificationStatus("Este navegador no admite notificaciones web. Prueba con Chrome o instala MediCore como PWA.");
  } else if (!window.isSecureContext) {
    notificationButton.disabled = true;
    setNotificationStatus("Las notificaciones requieren una conexión segura HTTPS.");
  } else if (Notification.permission === "granted") {
    notificationButton.textContent = "🔔 Enviar notificación de prueba";
    setNotificationStatus("Las notificaciones están permitidas en este dispositivo.");
  } else if (Notification.permission === "denied") {
    setNotificationStatus("Las notificaciones están bloqueadas. Actívalas en los permisos del sitio desde tu navegador.");
  }

  notificationButton.addEventListener("click", async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    try {
      notificationButton.disabled = true;
      setNotificationStatus("Solicitando permiso para mostrar notificaciones…");

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setNotificationStatus(permission === "denied"
          ? "No se concedió el permiso. Puedes habilitarlo en los ajustes del sitio."
          : "No se activaron las notificaciones. Puedes intentarlo de nuevo cuando quieras.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("MediCore · Notificaciones activadas", {
        body: "¡Todo listo! MediCore puede mostrar avisos en este dispositivo.",
        icon: "./icons/medicore-icon.svg",
        badge: "./icons/medicore-icon.svg",
        tag: "medicore-test-notification",
        data: { url: "./panel.html" }
      });

      notificationButton.textContent = "🔔 Enviar otra notificación";
      setNotificationStatus("¡Listo! Se envió una notificación de prueba a tu dispositivo.");
    } catch (error) {
      console.error("No se pudo mostrar la notificación:", error);
      setNotificationStatus("No se pudo mostrar el aviso. Revisa los permisos del navegador e inténtalo de nuevo.");
    } finally {
      notificationButton.disabled = false;
    }
  });
}
\n
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
