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
