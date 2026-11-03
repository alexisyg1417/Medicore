'use strict';
const crypto = require('node:crypto');
const PROVIDERS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com']);
function validateSubscription(s) {
  try {
    const u = new URL(s.endpoint);
    const key = Buffer.from(s.keys.p256dh, 'base64url');
    return s.endpoint.length < 2048 && u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      PROVIDERS.has(u.hostname) && key.length === 65 && key[0] === 4 &&
      Buffer.from(s.keys.auth, 'base64url').length === 16;
  } catch { return false; }
}
function createPushHandler({ env = process.env, sender, schedule = setTimeout } = {}) {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const secret = env.PUSH_TOKEN_SECRET;
  const ready = Boolean(publicKey && privateKey && secret);
  const origins = new Set((env.PUSH_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
  const appOrigin = env.PUBLIC_ORIGIN || 'http://localhost:3000';
  origins.add(appOrigin);
  const jobs = new Map(), rates = new Map();
  function sign(body) { return crypto.createHmac('sha256', secret).update(body).digest('base64url'); }
  function encode(sub) {
    const body = Buffer.from(JSON.stringify({ sub, exp: Date.now() + 3600000 })).toString('base64url');
    return body + '.' + sign(body);
  }
  function decode(token) {
    const [body, signature] = String(token || '').split('.');
    if (!body || !signature) throw new Error('token');
    const a = Buffer.from(signature), b = Buffer.from(sign(body));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('token');
    const data = JSON.parse(Buffer.from(body, 'base64url'));
    if (data.exp < Date.now() || !validateSubscription(data.sub)) throw new Error('token');
    return data.sub;
  }
  function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  async function body(req) {
    let data = '';
    for await (const chunk of req) {
      data += chunk;
      if (data.length > 8192) throw new Error('large');
    }
    return JSON.parse(data || '{}');
  }
  function rate(key, limit) {
    const now = Date.now();
    for (const [k, v] of rates) if (v.until < now) rates.delete(k);
    const v = rates.get(key) || { count: 0, until: now + 60000 };
    if (rates.size >= 1000 && !rates.has(key)) return false;
    v.count++; rates.set(key, v); return v.count <= limit;
  }
  async function deliver(job, sub) {
    try {
      job.status = 'sending';
      const send = sender || ((...args) => require('web-push').sendNotification(...args));
      const response = await send(sub, JSON.stringify({
        title: 'MediCore · Recordatorio', body: 'Tienes un recordatorio de prueba. Abre tu agenda.',
        url: './notificaciones.html', receipt: job.id
      }), { TTL: 120, timeout: 10000, urgency: 'normal',
        vapidDetails: { subject: 'https://github.com/alexisyg1417/Medicore', publicKey, privateKey } });
      if (job.status !== 'received') job.status = 'accepted';
      job.providerStatus = response.statusCode;
    } catch (error) {
      job.status = 'failed';
      job.error = [404, 410].includes(error.statusCode) ? 'La suscripción venció. Desactiva y vuelve a activar.' : 'El servicio push no aceptó el envío. Inténtalo nuevamente.';
      // Nunca registrar endpoints ni claves de suscripción.
      console.warn('[push] Falló el envío:', error.statusCode || 'network');
    }
  }
  return async function handle(req, res) {
    const url = new URL(req.url, appOrigin);
    if (!url.pathname.startsWith('/api/push/')) return false;
    const origin = req.headers.origin;
    if (origin && !origins.has(origin)) { json(res, 403, { error: 'Origen no permitido' }); return true; }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization'}); res.end(); return true;
    }
    if (url.pathname === '/api/push/config' && req.method === 'GET') {
      json(res, 200, { ready, publicKey: ready ? publicKey : null }); return true;
    }
    if (!ready) { json(res, 503, {error:'Las notificaciones del servidor aún no están configuradas.'}); return true; }
    if (req.method !== 'GET' && (!origin || !origins.has(origin))) {
      json(res, 403, {error:'Origen requerido'}); return true;
    }
    try {
      const now = Date.now();
      for (const [id, job] of jobs) if (job.expires < now) jobs.delete(id);
      if (url.pathname === '/api/push/subscribe' && req.method === 'POST') {
        if (!rate('subscribe:' + req.socket.remoteAddress, 60)) { json(res,429,{error:'Espera un minuto.'}); return true; }
        const sub = await body(req);
        if (!validateSubscription(sub)) { json(res,400,{error:'Suscripción no válida o proveedor no compatible.'}); return true; }
        json(res,200,{token:encode(sub)}); return true;
      }
      if (url.pathname === '/api/push/receipt' && req.method === 'POST') {
        const data = await body(req), job = jobs.get(data.id);
        if (job) job.status = 'received';
        json(res,200,{ok:true}); return true;
      }
      let sub;
      try { sub = decode(req.headers.authorization?.replace(/^Bearer /, '')); }
      catch { json(res,401,{error:'Activa las notificaciones para renovar la sesión.'}); return true; }
      const owner = crypto.createHash('sha256').update(sub.endpoint).digest('hex');
      if (url.pathname === '/api/push/test' && req.method === 'POST') {
        if (!rate('send:' + owner, 3) || !rate('global-send', 60)) { json(res,429,{error:'Espera un minuto antes de enviar otro aviso.'}); return true; }
        const data = await body(req);
        const delay = data.delay === 10 ? 10 : 0;
        if (jobs.size >= 1000) { json(res,503,{error:'Servicio ocupado. Inténtalo después.'}); return true; }
        const job = {id:crypto.randomBytes(24).toString('base64url'),owner,status:'scheduled',expires:now+600000};
        jobs.set(job.id,job);
        if (delay) schedule(() => deliver(job,sub),10000);
        else await deliver(job,sub);
        json(res,job.status === 'failed' ? 502 : 202,{id:job.id,status:job.status,error:job.error}); return true;
      }
      if (url.pathname.startsWith('/api/push/status/') && req.method === 'GET') {
        const job = jobs.get(url.pathname.split('/').pop());
        if (!job || job.owner !== owner) json(res,404,{error:'Prueba no disponible; vuelve a enviar.'});
        else json(res,200,{status:job.status,providerStatus:job.providerStatus,error:job.error});
        return true;
      }
      json(res,404,{error:'Ruta no encontrada'});
    } catch { json(res,400,{error:'Solicitud inválida'}); }
    return true;
  };
}
module.exports = { createPushHandler, validateSubscription };
