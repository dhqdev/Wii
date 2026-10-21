// OpenWii — servidor local.
// HTTP  (porta 8080): tela dos jogos no computador (localhost já é "contexto seguro").
// HTTPS (porta 8443): controle no celular (iOS/Android só liberam giroscópio em HTTPS).
// Os dois servidores compartilham o mesmo hub WebSocket em /ws.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const selfsigned = require('selfsigned');

const HTTP_PORT = Number(process.env.HTTP_PORT || 8080);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
const PUBLIC_DIR = path.join(__dirname, 'public');
const CERT_DIR = path.join(__dirname, '.cert');
const MAX_PLAYERS = 4;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function lanAddresses() {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) ips.push(ni.address);
    }
  }
  // Prioriza faixas típicas de Wi-Fi doméstico.
  const score = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3);
  return ips.sort((a, b) => score(a) - score(b));
}

const IPS = lanAddresses();
const HOST_IP = process.env.HOST_IP || IPS[0] || 'localhost';
const CONTROLLER_URL = `https://${HOST_IP}:${HTTPS_PORT}/controller.html`;

async function loadCert() {
  const meta = path.join(CERT_DIR, 'meta.json');
  const keyFile = path.join(CERT_DIR, 'key.pem');
  const certFile = path.join(CERT_DIR, 'cert.pem');
  const wanted = ['localhost', '127.0.0.1', ...IPS].join(',');
  try {
    const m = JSON.parse(fs.readFileSync(meta, 'utf8'));
    if (m.hosts === wanted && new Date(m.expires) > new Date()) {
      return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
    }
  } catch { /* gera um novo abaixo */ }

  console.log('Gerando certificado HTTPS autoassinado...');
  const notAfter = new Date();
  notAfter.setFullYear(notAfter.getFullYear() + 1);
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'OpenWii' }], {
    keySize: 2048,
    algorithm: 'sha256',
    notAfterDate: notAfter,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          ...IPS.map((ip) => ({ type: 7, ip })),
        ],
      },
    ],
  });
  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(keyFile, pems.private);
  fs.writeFileSync(certFile, pems.cert);
  fs.writeFileSync(meta, JSON.stringify({ hosts: wanted, expires: notAfter.toISOString() }));
  return { key: pems.private, cert: pems.cert };
}

// ---------- arquivos estáticos ----------

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://x');
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/config.json') {
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ controllerUrl: CONTROLLER_URL, ips: IPS, httpsPort: HTTPS_PORT }));
  }
  if (pathname === '/qr.svg') {
    const svg = await QRCode.toString(CONTROLLER_URL, { type: 'svg', margin: 1, color: { dark: '#1d2733', light: '#ffffff' } });
    res.writeHead(200, { 'Content-Type': MIME['.svg'], 'Cache-Control': 'no-store' });
    return res.end(svg);
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  if (pathname === '/c' || pathname === '/controller') pathname = '/controller.html';

  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Proibido');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ---------- hub WebSocket ----------
// Telas ("screen") recebem o estado de todos os controles.
// Controles ("controller") recebem um número de jogador (1–4) e mensagens de vibração.

const screens = new Set();
const players = new Map(); // id -> { ws, id }

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function toScreens(msg) {
  const data = JSON.stringify(msg);
  for (const s of screens) if (s.readyState === 1) s.send(data);
}
function playerList() {
  return [...players.keys()].sort();
}

function onConnection(ws, req) {
  const role = new URL(req.url, 'http://x').searchParams.get('role');

  if (role === 'controller') {
    let id = 0;
    for (let i = 1; i <= MAX_PLAYERS; i++) if (!players.has(i)) { id = i; break; }
    if (!id) {
      send(ws, { t: 'full' });
      return ws.close();
    }
    players.set(id, { ws, id });
    send(ws, { t: 'hello', id });
    toScreens({ t: 'join', id, players: playerList() });
    console.log(`Controle conectado: jogador ${id}`);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      msg.id = id;
      toScreens(msg);
    });
    ws.on('close', () => {
      players.delete(id);
      toScreens({ t: 'leave', id, players: playerList() });
      console.log(`Controle desconectado: jogador ${id}`);
    });
    return;
  }

  // tela
  screens.add(ws);
  send(ws, { t: 'state', players: playerList(), controllerUrl: CONTROLLER_URL });
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    // A tela pode pedir vibração a um controle (ou a todos com id 0).
    if (msg.t === 'rumble') {
      for (const p of players.values()) if (!msg.id || p.id === msg.id) send(p.ws, { t: 'rumble', ms: msg.ms || 60 });
    }
  });
  ws.on('close', () => screens.delete(ws));
}

// Mantém conexões vivas e derruba as que caíram (celular bloqueou a tela, etc.).
function heartbeat(wss) {
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
  });
  setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 5000).unref();
}

async function main() {
  const creds = await loadCert();
  const httpServer = http.createServer(handleRequest);
  const httpsServer = https.createServer(creds, handleRequest);

  for (const server of [httpServer, httpsServer]) {
    const wss = new WebSocketServer({ server, path: '/ws' });
    heartbeat(wss);
    wss.on('connection', onConnection);
  }

  httpServer.listen(HTTP_PORT, '0.0.0.0');
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('\n  🎮  OpenWii rodando!\n');
    console.log(`  Computador (tela dos jogos):  http://localhost:${HTTP_PORT}`);
    console.log(`  Celular (controle):           ${CONTROLLER_URL}`);
    if (IPS.length > 1) console.log(`  Outros IPs desta máquina:     ${IPS.slice(1).join(', ')}  (use HOST_IP=... se o QR não abrir)`);
    console.log('\n  No celular, aceite o aviso de certificado ("Avançado" > "Continuar").\n');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
