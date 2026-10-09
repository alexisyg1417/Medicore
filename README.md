# MediCore

MediCore es una propuesta académica de gestión clínica con una página de presentación y un panel interactivo instalable como Progressive Web App (PWA).

## Funciones

- Página principal informativa y diseño adaptable.
- Panel de control con resumen de actividad.
- Agenda para crear, buscar, filtrar y eliminar citas de demostración.
- Centro de notificaciones con filtros, lectura y eliminación de avisos.
- Notificaciones del navegador, sujetas al permiso del usuario y al soporte del dispositivo.
- Guardado local de citas y avisos mediante `localStorage`.
- Service Worker con caché de recursos para facilitar el acceso sin conexión.
- Diseño adaptable para escritorio y móviles.

## Cómo probarlo

1. Abre la página publicada en GitHub Pages mediante HTTPS.
2. Entra a **Panel de control** desde la página principal o abre `panel.html`.
3. Selecciona **Nueva cita** para registrar una cita de prueba.
4. Abre **Notificaciones** para revisar los avisos, marcarlos como leídos o eliminarlos.
5. Si quieres probar los avisos del sistema, pulsa **Activar notificaciones** y acepta el permiso del navegador.

También puedes servir la carpeta con un servidor local. El Service Worker y las notificaciones requieren un contexto seguro: HTTPS o localhost.

## Archivos principales

- `index.html`: página principal.
- `style.css`: estilos de la página principal.
- `script.js`: menú, instalación PWA y registro del Service Worker.
- `panel.html`: panel de control, agenda y centro de notificaciones.
- `panel.css`: estilos del panel.
- `panel.js`: comportamiento de agenda, avisos y almacenamiento local.
- `manifest.json`: metadatos de instalación de la PWA.
- `sw.js`: caché y comportamiento básico sin conexión.
- `icons/medicore-icon.svg`: icono de la aplicación.

## Alcance y privacidad

Esta versión es una demostración de frontend. Las citas y notificaciones se guardan únicamente en el navegador y dispositivo donde se crean; no se sincronizan entre usuarios o dispositivos. No introduzcas información clínica real ni datos personales sensibles.

Los avisos del navegador y los recordatorios programados por esta versión funcionan mientras el panel está abierto. Para enviar notificaciones push cuando la aplicación está cerrada, sincronizar información o administrar usuarios, hace falta integrar un backend y un servicio push.

MediCore es un proyecto académico y no sustituye un sistema clínico certificado ni el criterio de profesionales de salud.
