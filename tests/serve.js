// Tiny static server + Playwright page for browser tests.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'game');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
exports.open = async function (viewport = { width: 390, height: 800 }) {
  const { chromium } = require('playwright');
  const server = http.createServer((q, s) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const f = path.join(root, u === '/' ? 'index.html' : u);
    if (!f.startsWith(root) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
  });
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_/.test(m.text())) errors.push(m.text()); });
  await page.goto('http://localhost:' + server.address().port + '/index.html?nosw');
  return { page, errors, close: async () => { await browser.close(); server.close(); } };
};
