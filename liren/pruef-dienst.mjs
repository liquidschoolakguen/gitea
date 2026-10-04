import {createServer} from 'node:http';
import {spawn} from 'node:child_process';

// Diese API ist eine Attrappe; Transport und Sperrantworten durchlaufen das echte SDK.
const lage = {offen: false, ausfall: false, aufrufe: []};
const antwort = (res, status, body) => {
  res.writeHead(status, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(body));
};
const api = createServer(async (req, res) => {
  let text = '';
  for await (const teil of req) text += teil;
  const body = text ? JSON.parse(text) : {};
  lage.aufrufe.push({pfad: req.url, body});
  if (lage.ausfall) return antwort(res, 503, {error: 'LIREN_UNAVAILABLE'});
  if (req.headers['x-liren-api-key'] !== 'lk_test_giteapruefung') return antwort(res, 401, {error: 'API_KEY_INVALID'});
  if (req.url === '/api/v1/nm/references/gate') return antwort(res, 200, {open: lage.offen, requires: lage.offen ? null : 'membership'});
  if (req.url === '/api/v1/nm/widget-sessions') return antwort(res, 200, {clientSecret: 'cs-pruefung', sessionId: 'sid-pruefung', expiresAt: new Date(Date.now() + 600000).toISOString()});
  return antwort(res, 404, {error: 'NOT_FOUND'});
});
await new Promise((resolve) => api.listen(3305, '127.0.0.1', resolve));
const dienst = spawn(process.execPath, ['/dienst/node_modules/@liren/sdk/dist/cli.js', 'service'], {
  stdio: 'inherit', env: {...process.env,
    LIREN_API_KEY: 'lk_test_giteapruefung', LIREN_REFERENCE_KEY: 'lirk_v2_JZwmmzuhnXhw7yoXzePr6A_AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8', LIREN_DIENST_GEHEIMNIS: 'liren-gitea-pruefung-dienstgeheimnis-lokal-2026',
    LIREN_NUTZER_ID_FORMAT: 'ziffern', LIREN_API_URL: 'http://127.0.0.1:3305', LIREN_DIENST_HOST: '127.0.0.1', LIREN_DIENST_PORT: '3303',
  },
});
dienst.on('exit', (code) => process.exit(code ?? 1));
const kontrolle = createServer(async (req, res) => {
  if (req.method === 'GET') return antwort(res, 200, lage);
  let text = '';
  for await (const teil of req) text += teil;
  const body = JSON.parse(text);
  lage.offen = body.offen === true;
  lage.ausfall = body.ausfall === true;
  lage.aufrufe = [];
  antwort(res, 200, {bereit: true});
});
await new Promise((resolve) => kontrolle.listen(3304, '0.0.0.0', resolve));
console.info('Prüfdienst bereit; ausschließlich synthetische Daten.');
