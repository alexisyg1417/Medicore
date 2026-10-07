/* =========================
   MENÚ MÓVIL
========================= */

const menuButton = document.getElementById("menuButton");
const navMenu = document.getElementById("navMenu");


menuButton.addEventListener("click", function () {

    navMenu.classList.toggle("active");

});


const navLinks = document.querySelectorAll(".nav a");


navLinks.forEach(function (link) {

    link.addEventListener("click", function () {

        navMenu.classList.remove("active");

    });

});


/* =========================
   INSTALACIÓN PWA
========================= */

let deferredPrompt = null;

const installButton = document.getElementById("installButton");


window.addEventListener("beforeinstallprompt", function (event) {

    // Evita que el navegador muestre automáticamente
    event.preventDefault();

    // Guardamos el evento para utilizarlo después
    deferredPrompt = event;

    // Mostramos nuestro botón
    installButton.style.display = "inline-block";

});


installButton.addEventListener("click", async function () {

    if (!deferredPrompt) {
        return;
    }


    // Mostrar ventana de instalación
    deferredPrompt.prompt();


    // Esperar la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice;


    console.log("Resultado de instalación:", outcome);


    // Ya no podemos utilizar este evento nuevamente
    deferredPrompt = null;


    // Ocultar botón
    installButton.style.display = "none";

});


/* =========================
   DETECTAR INSTALACIÓN
========================= */

window.addEventListener("appinstalled", function () {

    console.log("MediCore fue instalada correctamente.");

    installButton.style.display = "none";

});


/* =========================
   SERVICE WORKER
========================= */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", function () {

        navigator.serviceWorker
            .register("sw.js")
            .then(function () {

                console.log("Service Worker registrado correctamente.");

            })
            .catch(function (error) {

                console.log(
                    "Error al registrar Service Worker:",
                    error
                );

            });

    });

}