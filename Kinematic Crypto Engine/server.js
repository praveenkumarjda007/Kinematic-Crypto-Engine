const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
let sequence = 1842;
let epoch = '7F3A';
const events = [];
function stamp() { return new Date().toISOString().slice(11, 19); }
function event(message, detail, level = 'ok') {
  const item = { time: stamp(), message, detail, level };
  events.unshift(item);
  if (events.length > 50) events.pop();
  return item;
}
event('Backend session initialized', 'SERVER · READY');

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(payload);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 4096) reject(new Error('Request too large')); });
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
    req.on('error', reject);
  });
}
function status() {
  return { latency: +(0.36 + Math.random() * 0.16).toFixed(2), entropy: +(7.55 + Math.random() * 0.55).toFixed(2), sequence, epoch, memory: 18.6, pidHz: 4000 };
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, status());
    if (url.pathname === '/api/events' && req.method === 'GET') return json(res, 200, { events });
    if (url.pathname === '/api/frame' && req.method === 'POST') {
      sequence += 1;
      const frameId = crypto.randomBytes(4).toString('hex').toUpperCase();
      event('Test frame authenticated', `TX · ${String(sequence).padStart(6, '0')}`);
      return json(res, 200, { accepted: true, frameId, ...status() });
    }
    if (url.pathname === '/api/resync' && req.method === 'POST') {
      event('RF loss detected — holding safe state', 'RX · 12 DROPPED', 'warn');
      epoch = crypto.randomBytes(2).toString('hex').toUpperCase();
      event('Deterministic state resynchronized', `SYNC · EPOCH 0x${epoch}`);
      return json(res, 200, { synchronized: true, epoch, sequence });
    }
    if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, service: 'ion-backend', uptime: process.uptime() });
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const filePath = path.normalize(path.join(root, file));
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return json(res, 404, { error: 'Not found' });
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) { json(res, 400, { error: error.message }); }
});
const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`ION backend listening on http://localhost:${port}`));
