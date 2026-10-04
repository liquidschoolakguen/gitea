import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [app, schluesselDatei] = process.argv.slice(2);
if (!app || !schluesselDatei) throw new Error('Aufruf: node liren/einrichten.mjs <App-Kennung> <Datei mit lokalem Test-Schlüssel>');
if (!/^[a-z][a-z0-9-]*$/u.test(app)) throw new Error('Die App-Kennung ist ungültig.');
const ziel = path.join(root, '.liren-lokal');
await mkdir(ziel, {recursive: true});
const env = path.join(ziel, '.env');
try {
  await access(env);
  throw new Error('Die lokale Konfiguration existiert bereits. Referenzschlüssel werden beim Wiederanlauf nicht ersetzt.');
} catch (fehler) {
  if (fehler.code !== 'ENOENT') throw fehler;
}
const apiKey = (await readFile(schluesselDatei, 'utf8')).trim();
if (!/^lk_test_[a-zA-Z0-9_-]+$/u.test(apiKey)) throw new Error('Die Datei enthält keinen lokalen Test-Schlüssel.');
const zeile = execFileSync(process.execPath, [path.join(root, '.liren-pakete/node_modules/@liren/sdk/dist/cli.js'), 'reference-key'], {encoding: 'utf8'}).trim();
if (!/^LIREN_REFERENCE_KEY=lirk_v2_[A-Za-z0-9_-]+$/u.test(zeile)) throw new Error('Das SDK liefert keinen Referenzschlüssel.');
await writeFile(env, [
  `LIREN_APP=${app}`, `LIREN_API_KEY=${apiKey}`,
  zeile,
  `LIREN_DIENST_GEHEIMNIS=${randomBytes(32).toString('hex')}`,
  'LIREN_WIDGET_ORIGIN=http://localhost:5178',
  'LIREN_API_URL=http://host.docker.internal:3001', '',
].join('\n'), {mode: 0o600, flag: 'wx'});
console.info('Lokale Konfiguration angelegt. Geheimnisse bleiben außerhalb von Git.');
