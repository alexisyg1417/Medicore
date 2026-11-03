(() => {
  const API = location.hostname.endsWith('github.io') ? 'https://medicore-production-e034.up.railway.app' : location.origin;
  const $ = id => document.getElementById(id);
  let registration, config, token = '', poll;
  const message = text => $('status').textContent = text;
  function enabled(value) { $('send').disabled = $('delayed').disabled = !value; }
  async function api(path, data) {
    const response = await fetch(API + '/api/push/' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { ...(data === undefined ? {} : {'Content-Type':'application/json'}), ...(token ? {Authorization:'Bearer '+token} : {}) },
      ...(data === undefined ? {} : {body:JSON.stringify(data)})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
    return result;
  }
  function decodeKey(key) {
    const value = key.replace(/-/g,'+').replace(/_/g,'/');
    return Uint8Array.from(atob(value+'='.repeat((4-value.length%4)%4)), c=>c.charCodeAt(0));
  }
  async function registerSubscription() {
    let sub = await registration.pushManager.getSubscription();
    if (sub) {
      const stored = sub.options.applicationServerKey;
      const expected = decodeKey(config.publicKey);
      if (stored && !new Uint8Array(stored).every((v,i)=>v===expected[i])) { await sub.unsubscribe(); sub=null; }
    }
    if (!sub) sub = await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(config.publicKey)});
    token = (await api('subscribe',sub.toJSON())).token;
    enabled(true); $('disable').disabled=false;
    message('Notificaciones activadas. Ya puedes enviar un recordatorio de prueba.');
  }
  $('activate').onclick = async () => {
    $('activate').disabled=true;
    try {
      // Se pide el permiso directamente desde el gesto del usuario.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permiso no concedido. En los ajustes del sitio, permite las notificaciones y vuelve a activar.');
      await registerSubscription();
    } catch(e) { enabled(false); message(e.message); }
    finally { $('activate').disabled=false; }
  };
  async function send(delay) {
    enabled(false); clearTimeout(poll);
    try {
      const result = await api('test',{delay});
      message(delay ? 'Prueba programada. Puedes cerrar esta pestaña; el servidor enviará el aviso en 10 segundos.' : 'El servicio push aceptó el envío. Esperando confirmación del navegador…');
      let attempts = 0;
      const check = async () => {
        try {
          const state = await api('status/'+result.id);
          if (state.status === 'received') { message('¡El navegador recibió el push y procesó la notificación! Revisa los avisos de tu dispositivo.'); return; }
          if (state.status === 'failed') { message(state.error); return; }
          if (++attempts < 30) poll=setTimeout(check,2000);
          else message('No llegó confirmación del navegador. Revisa Internet, los permisos y No molestar; la aceptación del servidor no garantiza que el aviso sea visible.');
        } catch(e) { message(e.message); }
      };
      poll=setTimeout(check,2000);
    } catch(e) { message(e.message); }
    finally { enabled(Boolean(token)); }
  }
  $('send').onclick=()=>send(0); $('delayed').onclick=()=>send(10);
  $('disable').onclick=async()=>{
    try { const sub=await registration.pushManager.getSubscription(); if(sub)await sub.unsubscribe(); token='';enabled(false);$('disable').disabled=true;clearTimeout(poll);message('Suscripción eliminada en este dispositivo.'); }
    catch(e){message('No se pudo desactivar: '+e.message);}
  };
  (async()=>{
    try {
      if (!isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Este navegador no admite Web Push aquí. Usa HTTPS y un navegador compatible; en iPhone/iPad abre la PWA desde la pantalla de inicio.');
      await navigator.serviceWorker.register('./sw.js');
      registration=await navigator.serviceWorker.ready;
      config=await api('config');
      if(!config.ready) throw new Error('El servidor todavía no tiene activadas las notificaciones push.');
      $('activate').disabled=false;
      const sub=await registration.pushManager.getSubscription();
      if(Notification.permission==='granted' && sub) await registerSubscription();
      else message(Notification.permission==='denied' ? 'Las notificaciones están bloqueadas. Permítelas en los ajustes del sitio para continuar.' : 'Servidor listo. Pulsa Activar notificaciones para comenzar.');
    } catch(e){message('No se pudo activar la prueba: '+e.message);}
  })();
})();
