(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const STORAGE = { appointments: "medicore_appointments_v1", notifications: "medicore_notifications_v1", sent: "medicore_reminders_sent_v1" };
  const demoNotices = [
    { id: "welcome", title: "Bienvenido al panel de MediCore", message: "Explora la agenda y el centro de notificaciones. Los datos de esta versión se guardan en este navegador.", type: "info", createdAt: new Date().toISOString(), read: false }
  ];
  let activeView = "inicio";
  let notificationFilter = "todas";
  let toastTimeout;

  function readStorage(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
    catch { return fallback; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { showToast("No se pudo guardar. Revisa el almacenamiento del navegador."); return false; }
  }
  function getAppointments() { return readStorage(STORAGE.appointments, []); }
  function getNotifications() {
    const stored = readStorage(STORAGE.notifications, null);
    if (stored) return stored;
    writeStorage(STORAGE.notifications, demoNotices);
    return demoNotices;
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
  }
  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 3200);
  }
  function dateTime(appointment) { return new Date(appointment.date + "T" + appointment.time); }
  function formatDate(date, options = { day: "2-digit", month: "short", year: "numeric" }) {
    return new Intl.DateTimeFormat("es-MX", options).format(date);
  }
  function formatTime(value) {
    return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(value);
  }
  function isUpcoming(item) { return dateTime(item).getTime() >= Date.now(); }
  function timeAgo(iso) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    if (diff < 60000) return "Ahora";
    if (diff < 3600000) return "Hace " + Math.floor(diff / 60000) + " min";
    if (diff < 86400000) return "Hace " + Math.floor(diff / 3600000) + " h";
    return formatDate(new Date(iso));
  }
  function updateCounts() {
    const appointments = getAppointments();
    const notices = getNotifications();
    const unread = notices.filter((n) => !n.read).length;
    $("#statTotal").textContent = appointments.length;
    $("#statUpcoming").textContent = appointments.filter(isUpcoming).length;
    $("#statUnread").textContent = unread;
    $("#navAppointmentCount").textContent = appointments.filter(isUpcoming).length;
    $("#navUnreadCount").textContent = unread;
    $("#headerDot").hidden = unread === 0;
  }
  function renderDashboardAppointments() {
    const items = getAppointments().filter(isUpcoming).sort((a,b) => dateTime(a)-dateTime(b)).slice(0,4);
    $("#dashboardAppointments").innerHTML = items.length ? items.map((item) => {
      const date = dateTime(item);
      return '<article class="dashboard-appointment"><div class="date-block"><strong>' + escapeHTML(new Intl.DateTimeFormat("es-MX",{day:"2-digit"}).format(date)) + '</strong><span>' + escapeHTML(new Intl.DateTimeFormat("es-MX",{month:"short"}).format(date).replace(".","")) + '</span></div><div class="appointment-info"><strong>' + escapeHTML(item.patient) + '</strong><span>' + escapeHTML(item.specialty) + '</span></div><span class="time-tag">' + escapeHTML(formatTime(date)) + '</span></article>';
    }).join("") : '<div class="empty-state"><strong>Tu agenda está despejada</strong>Aquí aparecerán las próximas citas que registres.</div>';
  }
  function renderDashboardNotifications() {
    const items = getNotifications().slice().sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,3);
    $("#dashboardNotifications").innerHTML = items.length ? items.map((n) => '<article class="mini-notification"><div class="mini-icon ' + escapeHTML(n.type || "info") + '">' + (n.type === "appointment" ? "◷" : n.type === "reminder" ? "!" : "✦") + '</div><div class="mini-copy"><strong>' + escapeHTML(n.title) + '</strong><p>' + escapeHTML(n.message) + '</p><time>' + escapeHTML(timeAgo(n.createdAt)) + '</time></div></article>').join("") : '<div class="empty-state">No tienes avisos por ahora.</div>';
  }
  function renderAppointments() {
    const query = ($("#appointmentSearch")?.value || "").trim().toLocaleLowerCase("es-MX");
    const filter = $("#appointmentFilter")?.value || "todas";
    const items = getAppointments().filter((item) => {
      const matchesQuery = (item.patient + " " + item.specialty).toLocaleLowerCase("es-MX").includes(query);
      const upcoming = isUpcoming(item);
      return matchesQuery && (filter === "todas" || (filter === "proximas" && upcoming) || (filter === "pasadas" && !upcoming));
    }).sort((a,b) => dateTime(a)-dateTime(b));
    $("#appointmentCountLabel").textContent = items.length + (items.length === 1 ? " cita" : " citas");
    $("#appointmentList").innerHTML = items.length ? items.map((item) => {
      const date = dateTime(item);
      return '<article class="appointment-row"><div class="patient-cell"><strong>' + escapeHTML(item.patient) + '</strong><span>' + escapeHTML(item.note || "Cita de consulta") + '</span></div><div class="detail-cell"><strong>' + escapeHTML(item.specialty) + '</strong><span>' + escapeHTML(formatDate(date)) + '</span></div><div class="detail-cell"><strong>' + escapeHTML(formatTime(date)) + '</strong><span>' + (isUpcoming(item) ? "Programada" : "Fecha pasada") + '</span></div><span class="status-pill ' + (isUpcoming(item) ? "" : "past") + '">' + (isUpcoming(item) ? "Próxima" : "Finalizada") + '</span><div class="row-actions"><button class="small-icon-button" data-delete-appointment="' + escapeHTML(item.id) + '" aria-label="Eliminar cita de ' + escapeHTML(item.patient) + '">Eliminar</button></div></article>';
    }).join("") : '<div class="empty-state"><strong>No hay citas que mostrar</strong>Agrega una cita o cambia los filtros de búsqueda.</div>';
  }
  function renderNotifications() {
    const all = getNotifications().slice().sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    const items = notificationFilter === "no-leidas" ? all.filter((n) => !n.read) : all;
    $("#notificationList").innerHTML = items.length ? items.map((n) => {
      const symbol = n.type === "appointment" ? "◷" : n.type === "reminder" ? "!" : "✦";
      return '<article class="notification-item"><div class="notification-symbol ' + escapeHTML(n.type || "info") + '">' + symbol + '</div><div class="notification-body"><div class="notification-title-row"><strong>' + escapeHTML(n.title) + '</strong>' + (!n.read ? '<span class="unread-dot" title="No leída"></span>' : '') + '</div><p>' + escapeHTML(n.message) + '</p><div class="notification-meta"><time>' + escapeHTML(timeAgo(n.createdAt)) + '</time><span>' + (n.read ? "Leída" : "No leída") + '</span></div></div><div class="notification-actions">' + (!n.read ? '<button class="small-icon-button" data-read-notification="' + escapeHTML(n.id) + '">Marcar leída</button>' : '') + '<button class="small-icon-button" data-delete-notification="' + escapeHTML(n.id) + '" aria-label="Eliminar notificación">Eliminar</button></div></article>';
    }).join("") : '<div class="empty-state"><strong>' + (notificationFilter === "no-leidas" ? "Todo al día" : "Sin notificaciones") + '</strong>' + (notificationFilter === "no-leidas" ? "No tienes avisos pendientes de leer." : "Cuando haya actividad, tus avisos aparecerán aquí.") + '</div>';
  }
  function renderAll() {
    updateCounts();
    renderDashboardAppointments();
    renderDashboardNotifications();
    renderAppointments();
    renderNotifications();
    updatePermissionStatus();
  }
  function addNotification(title, message, type = "info") {
    const notices = getNotifications();
    notices.unshift({ id: "n-" + Date.now() + "-" + Math.random().toString(36).slice(2,7), title, message, type, createdAt: new Date().toISOString(), read: false });
    writeStorage(STORAGE.notifications, notices.slice(0,100));
    renderAll();
  }
  function setView(view) {
    if (!["inicio","citas","notificaciones"].includes(view)) view = "inicio";
    activeView = view;
    document.querySelectorAll("[id^='view-']").forEach((section) => section.classList.toggle("view-hidden", section.id !== "view-" + view));
    document.querySelectorAll("[data-view]").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
    const labels = { inicio: "Resumen", citas: "Agenda de citas", notificaciones: "Notificaciones" };
    $("#currentSection").textContent = labels[view];
    history.replaceState(null, "", "#" + view);
    $("#sidebar").classList.remove("open");
    $("#mobileMenu").setAttribute("aria-expanded", "false");
    renderAll();
  }
  function openAppointmentDialog() {
    const dialog = $("#appointmentDialog");
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    $("#appointmentDate").min = localDate;
    $("#appointmentDate").value = localDate;
    const suggested = new Date(now.getTime() + 65*60*1000);
    suggested.setMinutes(Math.ceil(suggested.getMinutes()/5)*5, 0, 0);
    const suggestedDate = new Date(suggested.getTime() - suggested.getTimezoneOffset()*60000).toISOString().slice(0,10);
    $("#appointmentDate").value = suggestedDate;
    $("#appointmentTime").value = String(suggested.getHours()).padStart(2,"0") + ":" + String(suggested.getMinutes()).padStart(2,"0");
    dialog.showModal();
    $("#patientName").focus();
  }
  function closeAppointmentDialog() { $("#appointmentDialog").close(); }
  function saveAppointment(event) {
    event.preventDefault();
    const patient = $("#patientName").value.trim();
    const date = $("#appointmentDate").value;
    const time = $("#appointmentTime").value;
    if (!patient || !date || !time) return;
    const datetime = new Date(date + "T" + time);
    if (Number.isNaN(datetime.getTime()) || datetime.getTime() < Date.now()) {
      showToast("Elige una fecha y hora futuras.");
      return;
    }
    const appointment = {
      id: "a-" + Date.now() + "-" + Math.random().toString(36).slice(2,6),
      patient, specialty: $("#specialty").value, date, time,
      note: $("#appointmentNote").value.trim(), createdAt: new Date().toISOString()
    };
    const appointments = getAppointments();
    appointments.push(appointment);
    if (!writeStorage(STORAGE.appointments, appointments)) return;
    closeAppointmentDialog();
    $("#appointmentForm").reset();
    addNotification("Nueva cita registrada", "Se agendó una consulta de " + appointment.specialty + " para " + patient + " el " + formatDate(datetime) + " a las " + formatTime(datetime) + ".", "appointment");
    showToast("Cita guardada en este dispositivo.");
    setView("citas");
  }
  function deleteAppointment(id) {
    const appointment = getAppointments().find((item) => item.id === id);
    if (!appointment || !confirm("¿Quieres eliminar esta cita de demostración?")) return;
    writeStorage(STORAGE.appointments, getAppointments().filter((item) => item.id !== id));
    addNotification("Cita eliminada", "Se eliminó la cita de " + appointment.patient + " de la agenda local.", "info");
    showToast("Cita eliminada.");
  }
  function updatePermissionStatus() {
    const permission = ("Notification" in window) ? Notification.permission : "unsupported";
    const messages = {
      granted: "Notificaciones del navegador activadas en este dispositivo.",
      denied: "El navegador bloqueó los avisos. Puedes cambiarlo desde la configuración del sitio.",
      default: "Puedes activar avisos del navegador desde este dispositivo.",
      unsupported: "Este navegador no admite notificaciones del sistema."
    };
    const text = messages[permission] || messages.default;
    if ($("#permissionStatus")) $("#permissionStatus").textContent = text;
    if ($("#pushPageStatus")) $("#pushPageStatus").textContent = text;
    const buttonText = permission === "granted" ? "✓ Notificaciones activadas" : permission === "denied" ? "Permiso bloqueado en el navegador" : "♧ Activar notificaciones del navegador";
    ["#enableNotifications","#enableNotificationsPage"].forEach((selector) => {
      const button = $(selector);
      if (button) { button.textContent = buttonText; button.disabled = permission === "granted" || permission === "denied" || permission === "unsupported"; }
    });
  }
  async function enableNotifications() {
    if (!("Notification" in window)) { showToast("Este navegador no admite notificaciones del sistema."); updatePermissionStatus(); return; }
    if (!window.isSecureContext) { showToast("Las notificaciones necesitan HTTPS o localhost."); return; }
    try {
      const permission = await Notification.requestPermission();
      updatePermissionStatus();
      if (permission === "granted") {
        new Notification("MediCore está listo", { body: "Los avisos de demostración están activados mientras la app esté abierta.", icon: "./icons/medicore-icon.svg", tag: "medicore-enabled" });
        showToast("Notificaciones activadas.");
      } else showToast(permission === "denied" ? "El permiso fue bloqueado en el navegador." : "No se activaron las notificaciones.");
    } catch { showToast("No fue posible activar las notificaciones en este navegador."); }
  }
  function checkUpcomingReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const sent = readStorage(STORAGE.sent, []);
    const now = Date.now();
    getAppointments().forEach((item) => {
      const diff = dateTime(item).getTime() - now;
      if (diff > 0 && diff <= 15*60*1000 && !sent.includes(item.id)) {
        new Notification("Cita próxima en MediCore", { body: item.patient + " · " + item.specialty + " a las " + item.time, icon: "./icons/medicore-icon.svg", tag: "appointment-" + item.id });
        addNotification("Recordatorio de cita", "La cita de " + item.patient + " está programada para hoy a las " + item.time + ".", "reminder");
        sent.push(item.id);
        writeStorage(STORAGE.sent, sent);
      }
    });
  }
  document.querySelectorAll("[data-view]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); setView(link.dataset.view); }));
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.go)));
  $("#headerNotifications").addEventListener("click", () => setView("notificaciones"));
  $("#bannerNewAppointment").addEventListener("click", openAppointmentDialog);
  $("#openAppointmentForm").addEventListener("click", openAppointmentDialog);
  $("#closeAppointmentForm").addEventListener("click", closeAppointmentDialog);
  $("#cancelAppointment").addEventListener("click", closeAppointmentDialog);
  $("#appointmentForm").addEventListener("submit", saveAppointment);
  $("#appointmentSearch").addEventListener("input", renderAppointments);
  $("#appointmentFilter").addEventListener("change", renderAppointments);
  $("#appointmentList").addEventListener("click", (event) => { const button = event.target.closest("[data-delete-appointment]"); if (button) deleteAppointment(button.dataset.deleteAppointment); });
  $("#notificationList").addEventListener("click", (event) => {
    const readButton = event.target.closest("[data-read-notification]");
    const deleteButton = event.target.closest("[data-delete-notification]");
    let notices = getNotifications();
    if (readButton) {
      notices = notices.map((n) => n.id === readButton.dataset.readNotification ? {...n, read:true} : n);
      writeStorage(STORAGE.notifications, notices);
      renderAll();
    }
    if (deleteButton) {
      writeStorage(STORAGE.notifications, notices.filter((n) => n.id !== deleteButton.dataset.deleteNotification));
      renderAll();
      showToast("Aviso eliminado.");
    }
  });
  $("#markAllRead").addEventListener("click", () => { writeStorage(STORAGE.notifications, getNotifications().map((n) => ({...n, read:true}))); renderAll(); showToast("Todos los avisos están marcados como leídos."); });
  $("#clearNotifications").addEventListener("click", () => { if (confirm("¿Quieres borrar todos los avisos de este dispositivo?")) { writeStorage(STORAGE.notifications, []); renderAll(); showToast("Centro de avisos limpio."); } });
  document.querySelectorAll("[data-notification-filter]").forEach((button) => button.addEventListener("click", () => {
    notificationFilter = button.dataset.notificationFilter;
    document.querySelectorAll("[data-notification-filter]").forEach((b) => b.classList.toggle("active", b === button));
    renderNotifications();
  }));
  $("#enableNotifications").addEventListener("click", enableNotifications);
  $("#enableNotificationsPage").addEventListener("click", enableNotifications);
  $("#mobileMenu").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#mobileMenu").setAttribute("aria-expanded", String(open));
  });
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
  function updateConnection() {
    const online = navigator.onLine;
    $("#connectionStatus").textContent = online ? "Conectado" : "Modo sin conexión";
    $(".online-dot").classList.toggle("offline", !online);
  }
  $("#todayLabel").textContent = formatDate(new Date(), { weekday:"long", day:"numeric", month:"long" });
  getNotifications();
  updateConnection();
  setView(location.hash.replace("#","") || "inicio");
  checkUpcomingReminders();
  setInterval(checkUpcomingReminders, 30000);
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("No se pudo registrar el Service Worker", error));
  }
})();