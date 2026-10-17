"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const MIME = {
  ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8", ".json":"application/manifest+json; charset=utf-8",
  ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".svg":"image/svg+xml",
  ".webp":"image/webp", ".ico":"image/x-icon", ".webmanifest":"application/manifest+json; charset=utf-8",
  ".txt":"text/plain; charset=utf-8", ".xml":"application/xml; charset=utf-8"
};
const ROUTES = new Map([["/","index.html"],["/index","index.html"],["/demo","demo.html"],["/panel","panel.html"]]);
const server = http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400); return res.end("Solicitud no válida"); }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {"Allow":"GET, HEAD","Content-Type":"text/plain; charset=utf-8"}); return res.end("Método no permitido");
  }
  let relative = ROUTES.get(pathname) || pathname.replace(/^\/+/, "");
  if (!relative || relative.includes("\\") || relative.split("/").some(part => part === "." || part === "..")) {
    res.writeHead(400); return res.end("Ruta no válida");
  }
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT,"index.html")) {
    res.writeHead(403); return res.end("Acceso denegado");
  }
  fs.stat(file, (err,stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, {"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}); return res.end("No se encontró la página solicitada."); }
    const ext = path.extname(file).toLowerCase();
    const headers = {"Content-Type":MIME[ext] || "application/octet-stream","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"};
    headers["Cache-Control"] = ext === ".html" || ext === ".js" || ext === ".css" || ext === ".json" ? "no-store, max-age=0" : "public, max-age=86400";
    if (ext === ".html") headers["Content-Security-Policy"] = "upgrade-insecure-requests";
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).on("error",()=>{if(!res.headersSent)res.writeHead(500);res.end("Error interno");}).pipe(res);
  });
});
server.listen(PORT,"0.0.0.0",()=>console.log("MediCore listo en puerto "+PORT));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
