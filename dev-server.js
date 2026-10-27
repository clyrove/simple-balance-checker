/**
 * ============================================================================
 * LOCAL DEVELOPMENT SERVER & CORS API BRIDGE (ZERO DEPENDENCIES)
 * ============================================================================
 * Menjalankan server development lokal di http://127.0.0.1:8787 sekaligus
 * menjembatani request ke API asli `https://ceksaldo.al-wafi.sch.id/api/lookup.php`
 * bebas blokir CORS (baik saat dibuka via http://localhost:8787, VS Code Live
 * Server 127.0.0.1:5500, maupun file:// secara langsung).
 *
 * Cara Menjalankan:
 *   node dev-server.js
 * ============================================================================
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8787;
const REMOTE_API_URL = 'https://ceksaldo.al-wafi.sch.id/api/lookup.php';
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function handleApiProxy(req, res, parsedUrl) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let bodyChunks = [];
  req.on('data', (chunk) => bodyChunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(bodyChunks).toString('utf8');
    const targetUrl = new URL(REMOTE_API_URL);

    // Teruskan query string jika ada (misal ?wallet=...)
    if (parsedUrl.search) {
      targetUrl.search = parsedUrl.search;
    }

    const isPost = req.method === 'POST';
    const postData = isPost ? rawBody : '';

    const options = {
      hostname: targetUrl.hostname,
      port: 443,
      path: targetUrl.pathname + targetUrl.search,
      method: isPost ? 'POST' : 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AlWafi-BalanceKiosk-DevBridge/1.0'
      }
    };

    if (isPost) {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const proxyReq = https.request(options, (proxyRes) => {
      let responseChunks = [];
      proxyRes.on('data', (d) => responseChunks.push(d));
      proxyRes.on('end', () => {
        const responseBody = Buffer.concat(responseChunks);
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        });
        res.end(responseBody);
      });
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: false,
        code: 'proxy_network_error',
        message: 'Tidak dapat menghubungi server. Periksa koneksi atau hubungi tim IT.',
        detail: err.message
      }));
    });

    if (isPost && postData) {
      proxyReq.write(postData);
    }
    proxyReq.end();
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Tangani endpoint API Proxy (/api/lookup.php)
  if (pathname === '/api/lookup.php' || pathname.endsWith('/api/lookup.php')) {
    handleApiProxy(req, res, parsedUrl);
    return;
  }

  // 2. Layani file statis aplikasi Kiosk
  setCorsHeaders(res);
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(path.join(ROOT_DIR, relativePath));

  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(safePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('==================================================================');
  console.log(' AL-WAFI KIOSK LOCAL DEV SERVER & API BRIDGE ACTIVE');
  console.log(` -> Local App URL  : http://127.0.0.1:${PORT}`);
  console.log(` -> Local API Proxy: http://127.0.0.1:${PORT}/api/lookup.php`);
  console.log(` -> Target Backend : ${REMOTE_API_URL}`);
  console.log('==================================================================');
});
