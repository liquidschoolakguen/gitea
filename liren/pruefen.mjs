import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {pruefeIsoliert, abbruchSteuerung} from './pruef-lauf.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const token = process.env.LIREN_PRUEF_TOKEN ?? randomBytes(10).toString('hex');
if (!/^[a-f0-9]{20}$/u.test(token)) throw new Error('Ungültige eigene Prüfkennung.');
async function freierPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve)});
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const port = await freierPort();
let kontrollPort;
do { kontrollPort = await freierPort() } while (port === kontrollPort);
const steuerung = abbruchSteuerung();
process.on('SIGINT', steuerung.abbrechen);
process.on('SIGTERM', steuerung.abbrechen);
async function run(programm, args, {env, aufraeumen = false}) {
  if (steuerung.abgebrochen && !aufraeumen) throw new Error('Prüfung abgebrochen.');
  const aktiv = spawn(programm, args, {cwd: root, env: {...process.env, ...env}, stdio: 'inherit', windowsHide: true});
  steuerung.setze(aktiv, aufraeumen);
  const timer = setTimeout(() => aktiv.kill('SIGTERM'), 15 * 60 * 1000);
  try {
    const code = await new Promise((resolve, reject) => {aktiv.once('error', reject); aktiv.once('close', resolve)});
    if (code !== 0) throw new Error(`Prüfschritt gescheitert: ${programm} (Exit ${code}).`);
  } finally {clearTimeout(timer); steuerung.setze(null, false)}
}
try {
  await pruefeIsoliert({token, port, kontrollPort, node: process.execPath, run,
    quellen: [process.env.LIREN_PRUEF_QUELL_IMAGE ?? 'liren-gitea:28.0.0',
      process.env.LIREN_PRUEF_QUELL_DIENST_IMAGE ?? 'liren-gitea-dienst:0.28.0']});
} catch (error) {console.error(error.message); process.exitCode = 1} finally {
  process.removeListener('SIGINT', steuerung.abbrechen);
  process.removeListener('SIGTERM', steuerung.abbrechen);
}
