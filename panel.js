(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const client = window.medicoreSupabase || (window.supabase?.createClient && window.MEDICORE_SUPABASE_CONFIG
    ? window.supabase.createClient(window.MEDICORE_SUPABASE_CONFIG.url, window.MEDICORE_SUPABASE_CONFIG.publishableKey)
    : null);
  let appointments = [];
  let notifications = [];
  let activeView = "inicio";
  let notificationFilter = "todas";
  let toastTimer;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = (message) => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  };
  const formatDate = (date, options = {day:"2-digit", month:"short", year:"numeric"}) =>
    new Intl.DateTimeFormat("es-MX", options).format(date);
  const formatTime = (date) => new Intl.DateTimeFormat("es-MX", {hour:"2-digit", minute:"2-digit"}).format(date);
  const toDate = (a) => new Date(a.date + "T" + String(a.time).slice(0,5));
  const upcoming = (a) => toDate(a).getTime() >= Date.now();
  const ago = (iso) => {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "Ahora";
    if (mins < 60) return "Hace " + mins + " min";
    if (mins < 1440) return "Hace " + Math.floor(mins/60) + " h";
    return formatDate(new Date(iso));
  };
  function updateConnection() {
    $("#connectionStatus").textContent = navigator.onLine ? "Conectado" : "Sin conexión";
    $(".online-dot")?.classList.toggle("offline", !navigator.onLine);
  }
  function updateCounts() {
    const unread = notifications.filter(n => !n.read).length;
    $("#statTotal").textContent = appointments.length;
    $("#statUpcoming").textContent = appointments.filter(upcoming).length;
    $("#statUnread").textContent = unread;
    $("#navAppointmentCount").textContent = appointments.filter(upcoming).length;
    $("#navUnreadCount").textContent = unread;
    $("#headerDot").hidden = unread === 0;
  }
  function renderDashboardAppointments() {
    const list = appointments.filter(upcoming).sort((a,b) => toDate(a)-toDate(b)).slice(0,4);
    $("#dashboardAppointments").innerHTML = list.length ? list.map(a => {
      const d = toDate(a);
      return '<article class="dashboard-appointment"><div class="date-block"><strong>'+esc(formatDate(d,{day:"2-digit"}))+'</strong><span>'+esc(formatDate(d,{month:"short"}).replace(".",""))+'</span></div><div class="appointment-info"><strong>'+esc(a.patient)+'</strong><span>'+esc(a.specialty)+'</span></div><span class="time-tag">'+esc(formatTime(d))+'</span></article>';
    }).join("") : '<div class="empty-state"><strong>Tu agenda está despejada</strong>Aquí aparecerán las próximas citas que registres.</div>';
  }
  function renderDashboardNotifications() {
    const list = [...notifications].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,3);
    $("#dashboardNotifications").innerHTML = list.length ? list.map(n => '<article class="mini-notification"><div class="mini-icon '+esc(n.type)+'">'+(n.type==="appointment"?"◷":n.type==="reminder"?"!":"✦")+'</div><div class="mini-copy"><strong>'+esc(n.title)+'</strong><p>'+esc(n.message)+'</p><time>'+esc(ago(n.createdAt))+'</time></div></article>').join("") : '<div class="empty-state">No tienes avisos por ahora.</div>';
  }
  function renderAppointments() {
    const q = ($("#appointmentSearch").value || "").trim().toLocaleLowerCase("es-MX");
    const filter = $("#appointmentFilter").value;
    const list = appointments.filter(a => (a.patient+" "+a.specialty).toLocaleLowerCase("es-MX").includes(q) &&
      (filter==="todas" || (filter==="proximas" && upcoming(a)) || (filter==="pasadas" && !upcoming(a))))
      .sort((a,b) => toDate(a)-toDate(b));
    $("#appointmentCountLabel").textContent = list.length + (list.length===1 ? " cita" : " citas");
    $("#appointmentList").innerHTML = list.length ? list.map(a => {
      const d = toDate(a);
      return '<article class="appointment-row"><div class="patient-cell"><strong>'+esc(a.patient)+'</strong><span>'+esc(a.note || "Cita de consulta")+'</span></div><div class="detail-cell"><strong>'+esc(a.specialty)+'</strong><span>'+esc(formatDate(d))+'</span></div><div class="detail-cell"><strong>'+esc(formatTime(d))+'</strong><span>'+(upcoming(a)?"Programada":"Fecha pasada")+'</span></div><span class="status-pill '+(upcoming(a)?"":"past")+'">'+(upcoming(a)?"Próxima":"Finalizada")+'</span><div class="row-actions"><button class="small-icon-button" data-delete-appointment="'+esc(a.id)+'">Eliminar</button></div></article>';
    }).join("") : '<div class="empty-state"><strong>No hay citas que mostrar</strong>Agrega una cita o cambia los filtros.</div>';
  }
  function renderNotifications() {
    const list = [...notifications].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))
      .filter(n => notificationFilter!=="no-leidas" || !n.read);
    $("#notificationList").innerHTML = list.length ? list.map(n => {
      const symbol = n.type==="appointment" ? "◷" : n.type==="reminder" ? "!" : "✦";
      return '<article class="notification-item"><div class="notification-symbol '+esc(n.type)+'">'+symbol+'</div><div class="notification-body"><div class="notification-title-row"><strong>'+esc(n.title)+'</strong>'+(!n.read?'<span class="unread-dot"></span>':'')+'</div><p>'+esc(n.message)+'</p><div class="notification-meta"><time>'+esc(ago(n.createdAt))+'</time><span>'+(n.read?"Leída":"No leída")+'</span></div></div><div class="notification-actions">'+(!n.read?'<button class="small-icon-button" data-read-notification="'+esc(n.id)+'">Marcar leída</button>':'')+'<button class="small-icon-button" data-delete-notification="'+esc(n.id)+'">Eliminar</button></div></article>';
    }).join("") : '<div class="empty-state"><strong>'+(notificationFilter==="no-leidas"?"Todo al día":"Sin notificaciones")+'</strong>No hay avisos para mostrar.</div>';
  }
  function renderAll() {
    updateCounts(); renderDashboardAppointments(); renderDashboardNotifications(); renderAppointments(); renderNotifications(); updatePermissionStatus();
  }
  async function loadData() {
    if (!client) { toast("No se pudo iniciar la conexión con Supabase."); return; }
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;
    const [aResult, nResult] = await Promise.all([
      client.from("appointments").select("*").order("appointment_date",{ascending:true}).order("appointment_time",{ascending:true}),
      client.from("notifications").select("*").order("created_at",{ascending:false}).limit(100)
    ]);
    if (aResult.error) throw aResult.error;
    if (nResult.error) throw nResult.error;
    appointments = (aResult.data || []).map(a => ({id:a.id, patient:a.patient_name, specialty:a.specialty, date:a.appointment_date, time:a.appointment_time, note:a.note, createdAt:a.created_at, status:a.status}));
    notifications = (nResult.data || []).map(n => ({id:n.id, title:n.title, message:n.message, type:n.type, createdAt:n.created_at, read:!!n.read_at}));
    renderAll();
  }
  async function addNotification(title, message, type="info") {
    const { error } = await client.from("notifications").insert({title,message,type});
    if (error) throw error;
    await loadData();
  }
  function setView(view) {
    if (!["inicio","citas","notificaciones"].includes(view)) view="inicio";
    activeView=view;
    document.querySelectorAll("[id^='view-']").forEach(s => s.classList.toggle("view-hidden",s.id!=="view-"+view));
    document.querySelectorAll("[data-view]").forEach(a => a.classList.toggle("active",a.dataset.view===view));
    $("#currentSection").textContent=({inicio:"Resumen",citas:"Agenda de citas",notificaciones:"Notificaciones"})[view];
    history.replaceState(null,"","#"+view);
    $("#sidebar").classList.remove("open");
    $("#mobileMenu").setAttribute("aria-expanded","false");
    renderAll();
  }
  function openAppointmentDialog() {
    const now=new Date();
    const suggested=new Date(now.getTime()+65*60000);
    suggested.setMinutes(Math.ceil(suggested.getMinutes()/5)*5,0,0);
    const local=(d)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    $("#appointmentDate").min=local(now);
    $("#appointmentDate").value=local(suggested);
    $("#appointmentTime").value=String(suggested.getHours()).padStart(2,"0")+":"+String(suggested.getMinutes()).padStart(2,"0");
    $("#appointmentDialog").showModal();
  }
  async function saveAppointment(event) {
    event.preventDefault();
    const patient=$("#patientName").value.trim(), date=$("#appointmentDate").value, time=$("#appointmentTime").value;
    if (!patient || !date || !time) return;
    if (new Date(date+"T"+time).getTime()<Date.now()) { toast("Elige una fecha y hora futuras."); return; }
    const {error}=await client.from("appointments").insert({
      patient_name:patient, specialty:$("#specialty").value, appointment_date:date,
      appointment_time:time, note:$("#appointmentNote").value.trim()
    });
    if (error) { toast("No se pudo guardar la cita: "+error.message); return; }
    try { await addNotification("Nueva cita registrada","Se agendó una consulta de "+$("#specialty").value+" para "+patient+".","appointment"); }
    catch (e) { console.error(e); await loadData(); }
    $("#appointmentDialog").close(); $("#appointmentForm").reset();
    setView("citas"); toast("Cita guardada en la base de datos.");
  }
  async function deleteAppointment(id) {
    const item=appointments.find(a=>a.id===id);
    if (!item || !confirm("¿Quieres eliminar esta cita?")) return;
    const {error}=await client.from("appointments").delete().eq("id",id);
    if(error){toast("No se pudo eliminar: "+error.message);return;}
    try { await addNotification("Cita eliminada","Se eliminó la cita de "+item.patient+".","info"); } catch(e){await loadData();}
    toast("Cita eliminada de Supabase.");
  }
  function updatePermissionStatus() {
    const p=("Notification" in window)?Notification.permission:"unsupported";
    const messages={granted:"Notificaciones del navegador activadas en este dispositivo.",denied:"Los avisos están bloqueados en los permisos del navegador.",default:"Puedes activar avisos del navegador desde este dispositivo.",unsupported:"Este navegador no admite notificaciones."};
    const message=messages[p]||messages.default;
    if($("#permissionStatus")) $("#permissionStatus").textContent=message;
    if($("#pushPageStatus")) $("#pushPageStatus").textContent=message;
    ["#enableNotifications","#enableNotificationsPage"].forEach(s=>{const b=$(s);if(b){b.textContent=p==="granted"?"✓ Notificaciones activadas":p==="denied"?"Permiso bloqueado":"♧ Activar notificaciones del navegador";b.disabled=p==="granted"||p==="denied"||p==="unsupported";}});
  }
  async function enableNotifications() {
    if(!("Notification" in window)||!window.isSecureContext){toast("Las notificaciones necesitan un navegador compatible y HTTPS.");return;}
    const p=await Notification.requestPermission(); updatePermissionStatus();
    if(p==="granted"){new Notification("MediCore está listo",{body:"Puedes consultar tus citas y avisos desde el panel.",icon:"./icons/medicore-icon-192.png"});toast("Notificaciones activadas.");}
  }

  document.querySelectorAll("[data-view]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();setView(a.dataset.view);}));
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.go)));
  $("#headerNotifications").addEventListener("click",()=>setView("notificaciones"));
  $("#bannerNewAppointment").addEventListener("click",openAppointmentDialog);
  $("#openAppointmentForm").addEventListener("click",openAppointmentDialog);
  $("#closeAppointmentForm").addEventListener("click",()=>$("#appointmentDialog").close());
  $("#cancelAppointment").addEventListener("click",()=>$("#appointmentDialog").close());
  $("#appointmentForm").addEventListener("submit",saveAppointment);
  $("#appointmentSearch").addEventListener("input",renderAppointments);
  $("#appointmentFilter").addEventListener("change",renderAppointments);
  $("#appointmentList").addEventListener("click",e=>{const b=e.target.closest("[data-delete-appointment]");if(b)deleteAppointment(b.dataset.deleteAppointment).catch(err=>toast(err.message));});
  $("#notificationList").addEventListener("click",async e=>{
    const read=e.target.closest("[data-read-notification]"), del=e.target.closest("[data-delete-notification]");
    try {
      if(read){const {error}=await client.from("notifications").update({read_at:new Date().toISOString()}).eq("id",read.dataset.readNotification);if(error)throw error;}
      if(del){const {error}=await client.from("notifications").delete().eq("id",del.dataset.deleteNotification);if(error)throw error;}
      await loadData();
    } catch(err){toast("No se pudo actualizar el aviso: "+err.message);}
  });
  $("#markAllRead").addEventListener("click",async()=>{
    const {error}=await client.from("notifications").update({read_at:new Date().toISOString()}).is("read_at",null);
    if(error)toast(error.message);else{await loadData();toast("Todos los avisos están marcados como leídos.");}
  });
  $("#clearNotifications").addEventListener("click",async()=>{
    if(!confirm("¿Quieres borrar todos tus avisos guardados?"))return;
    const {error}=await client.from("notifications").delete().not("id","is",null);
    if(error)toast(error.message);else{await loadData();toast("Centro de avisos limpio.");}
  });
  document.querySelectorAll("[data-notification-filter]").forEach(b=>b.addEventListener("click",()=>{notificationFilter=b.dataset.notificationFilter;document.querySelectorAll("[data-notification-filter]").forEach(x=>x.classList.toggle("active",x===b));renderNotifications();}));
  $("#enableNotifications").addEventListener("click",enableNotifications);
  $("#enableNotificationsPage").addEventListener("click",enableNotifications);
  $("#mobileMenu").addEventListener("click",()=>{const open=$("#sidebar").classList.toggle("open");$("#mobileMenu").setAttribute("aria-expanded",String(open));});
  window.addEventListener("online",updateConnection); window.addEventListener("offline",updateConnection);
  $("#todayLabel").textContent=formatDate(new Date(),{weekday:"long",day:"numeric",month:"long"});
  updateConnection();
  if(client){
    client.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){appointments=[];notifications=[];renderAll();}else if(session?.user){setTimeout(()=>loadData().catch(e=>toast("Error al cargar datos: "+e.message)),0);}});
    client.auth.getSession().then(({data})=>{if(data.session?.user)loadData().catch(e=>toast("Error al cargar datos: "+e.message));});
  }
  setView(location.hash.replace("#","")||"inicio");
  if("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("./sw.js").catch(e=>console.warn("Service Worker:",e));
})();