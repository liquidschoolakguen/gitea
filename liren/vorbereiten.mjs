// Lokale Paketbytes kommen aus einem festen SDK-Stand, nicht aus einer zweiten Implementierung.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cp, mkdir, readFile, readdir, writeFile, access, rm} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const quelle = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Aufruf: node liren/vorbereiten.mjs <Pfad zum festen NM-Checkout>');
const run = (programm, args, cwd) => execFileSync(programm, args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const aenderungen = run('git', ['status', '--porcelain', '--', 'packages/liren', 'packages/liren-go', 'shared/nm-sdk', 'shared/liren-embed'], quelle);
if (aenderungen.trim()) throw new Error('Der SDK-Quellstand enthält ungesicherte Änderungen.');
const commit = run('git', ['rev-parse', 'HEAD'], quelle).trim();
const ziel = path.join(root, '.liren-pakete');
await mkdir(ziel, {recursive: true});
let npm;
for (const kandidat of [process.env.npm_execpath,
  path.resolve(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  path.resolve(path.dirname(process.execPath), '../share/nodejs/npm/bin/npm-cli.js')].filter(Boolean)) {
  try { await access(kandidat); npm = kandidat; break } catch { /* Nächster Installationsort. */ }
}
if (!npm) throw new Error('Die npm-Kommandozeile dieser Node-Installation fehlt.');
const ausgabe = run(process.execPath, [npm, 'pack', '--pack-destination', ziel], path.join(quelle, 'packages/liren'));
const datei = ausgabe.trim().split(/\r?\n/u).at(-1);
if (!/^liren-sdk-\d+\.\d+\.\d+\.tgz$/u.test(datei)) throw new Error('npm pack liefert kein SDK-Paket.');
await cp(path.join(ziel, datei), path.join(ziel, 'sdk.tgz'));
await writeFile(path.join(ziel, 'package.json'), `${JSON.stringify({private: true, type: 'module', dependencies: {'@liren/sdk': 'file:./sdk.tgz'}}, null, 2)}\n`);
await rm(path.join(ziel, 'package-lock.json'), {force: true});
run(process.execPath, [npm, 'install', '--package-lock-only', '--no-audit', '--no-fund', '--ignore-scripts'], ziel);
run(process.execPath, [npm, 'ci', '--no-audit', '--no-fund', '--ignore-scripts'], ziel);
const dist = path.join(ziel, 'node_modules/@liren/sdk/dist');
await mkdir(path.join(ziel, 'browser'), {recursive: true});
for (const datei of await readdir(dist)) if (datei.endsWith('.js')) await cp(path.join(dist, datei), path.join(ziel, 'browser', datei));
// Der lokale Prüfer liest dieselben SDK-Dateien wie die spätere Browser-Auslieferung.
await cp(path.join(ziel, 'browser'), path.join(root, 'liren/sdk'), {recursive: true});
await cp(path.join(quelle, 'packages/liren-go'), path.join(ziel, 'go'), {recursive: true, filter: (datei) => datei.split(path.sep).every((teil) => !['node_modules', '.git'].includes(teil))});
const version = JSON.parse(await readFile(path.join(ziel, 'node_modules/@liren/sdk/package.json'), 'utf8')).version;
const paketSha256 = createHash('sha256').update(await readFile(path.join(ziel, 'sdk.tgz'))).digest('hex');
const adapterSha256 = createHash('sha256').update((await readFile(path.join(ziel, 'go/liren.go'), 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
await writeFile(path.join(root, 'liren/stand.json'), `${JSON.stringify({quelle: 'liquidschoolakguen/NM', commit, version, paketSha256, adapterSha256}, null, 2)}\n`);
console.info(`Liren ${version} aus ${commit.slice(0, 8)} lokal vorbereitet; Paket und Go-Anschluss festgehalten.`);
