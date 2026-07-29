/**
 * serve.js — Servidor estático liviano para el frontend de ShopMS.
 * Sin dependencias npm. Solo Node.js nativo.
 * Uso: node apps/frontend/serve.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;
const FRONTEND_DIR = path.join(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  // Quitar query strings
  urlPath = urlPath.split('?')[0];

  const filePath = path.join(FRONTEND_DIR, urlPath);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Para SPA: devolver index.html si el archivo no existe
      fs.readFile(path.join(FRONTEND_DIR, 'index.html'), (err2, html) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🖥️  ShopMS Frontend corriendo en → http://localhost:${PORT}`);
  console.log(`📡  Conectando al API Gateway en → http://localhost:3000/api`);
  console.log(`\nCtrl+C para detener.\n`);
});
