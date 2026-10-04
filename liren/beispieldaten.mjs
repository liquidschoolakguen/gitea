import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const container = 'liren-gitea-gitea-1';
const basis = 'http://127.0.0.1:3300';
const passwort = 'LirenDemo2026!';
const api = (user, pfad, optionen = {}) => fetch(`${basis}/api/v1${pfad}`, {...optionen, headers: {...optionen.headers, Authorization: `Basic ${Buffer.from(`${user}:${passwort}`).toString('base64')}`}});
const post = (body) => ({method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
for (const [user, admin] of [['bob', true], ['alice', false], ['carol', false]]) {
  if ((await api(user, '/user')).status === 200) continue;
  execFileSync('docker', ['exec', '--user', 'git', container, 'gitea', '--config', '/data/gitea/conf/app.ini', 'admin', 'user', 'create', '--username', user, '--password', passwort, '--email', `${user}@example.invalid`, `--admin=${admin}`, '--must-change-password=false'], {stdio: 'pipe'});
}
const repo = '/repos/bob/liren-vorfuehrung';
const vorhanden = await api('bob', repo);
if (vorhanden.status === 404) {
  const res = await api('bob', '/user/repos', post({name: 'liren-vorfuehrung', description: 'Lokale Gitea-Vorführung mit Liren.', private: false, auto_init: true}));
  assert.equal(res.status, 201);
} else assert.equal(vorhanden.status, 200);
const issues = await (await api('bob', `${repo}/issues`)).json();
if (issues.every((issue) => issue.title !== 'Eine öffentliche Aufgabe von Bob')) {
  const res = await api('bob', `${repo}/issues`, post({title: 'Eine öffentliche Aufgabe von Bob', body: 'Diese Aufgabe bleibt öffentlich lesbar.\n\nAlice kann Bob einen Kommentar schreiben. Das Kommentartor steht direkt vor dem Formular. Bob sieht das Torende an Alices angekommenem Kommentar.\n\nDie Gitea-Anmeldung verwendet lokale App-Konten. Die Anmeldung in der Liren-Fläche verbindet das angemeldete Gitea-Konto mit Liren.'}));
  assert.equal(res.status, 201);
}
console.info('Lokale Gitea-Vorführung angelegt: http://127.0.0.1:3300/bob/liren-vorfuehrung/issues/1');
console.info('App-Konten alice, bob und carol; öffentliches Testpasswort: LirenDemo2026!');
