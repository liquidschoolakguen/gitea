import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const basis = 'http://127.0.0.1:13300';
const kontrolle = 'http://127.0.0.1:13304';
for (const url of [`${basis}/api/v1/version`, kontrolle]) {
  let bereit = false;
  for (let versuch = 0; versuch < 150; versuch += 1) {
    try { bereit = (await fetch(url)).ok } catch { /* Start noch nicht abgeschlossen. */ }
    if (bereit) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(bereit, `Lokaler Prüfprozess nicht erreichbar: ${url}`);
}
let schritte = 0;
const pruefe = async (name, fn) => { await fn(); console.info(`✓ ${name}`); schritte += 1 };
const setze = async (lage) => { assert.equal((await fetch(kontrolle, {method: 'POST', body: JSON.stringify(lage)})).status, 200) };
const json = (body, method = 'POST') => ({method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
const api = (user, pfad, optionen = {}) => fetch(`${basis}/api/v1${pfad}`, {...optionen, headers: {...optionen.headers, Authorization: `Basic ${Buffer.from(`${user}:LirenDemo2026!`).toString('base64')}`}});
const erzeuge = async (user, pfad, body) => {
  const res = await api(user, pfad, json(body));
  assert.equal(res.status, 201, await res.text());
};
function browser() {
  const cookies = new Map();
  return async (pfad, optionen = {}) => {
    const res = await fetch(`${basis}${pfad}`, {...optionen, redirect: 'manual', headers: {...optionen.headers, Origin: basis, 'Sec-Fetch-Site': 'same-origin', Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')}});
    for (const cookie of res.headers.getSetCookie()) {
      const teil = cookie.split(';')[0]; const at = teil.indexOf('='); cookies.set(teil.slice(0, at), teil.slice(at + 1));
    }
    return res;
  };
}
async function anmelden(user) {
  const web = browser();
  const html = await (await web('/user/login')).text();
  assert.ok(html.includes('user_name'), 'Das echte Gitea-Anmeldeformular ist erreichbar.');
  const res = await web('/user/login', {method: 'POST', body: new URLSearchParams({user_name: user, password: 'LirenDemo2026!'})});
  assert.equal(res.status, 303);
  return web;
}

for (const [user, admin] of [['bob', true], ['alice', false], ['carol', false]]) {
  const vorhanden = await api(user, '/user');
  if (vorhanden.status === 200) continue;
  execFileSync('docker', ['exec', '--user', 'git', 'liren-gitea-pruefung-gitea-1', 'gitea', '--config', '/data/gitea/conf/app.ini', 'admin', 'user', 'create', '--username', user, '--password', 'LirenDemo2026!', '--email', `${user}@example.invalid`, `--admin=${admin}`, '--must-change-password=false'], {stdio: 'pipe'});
}
const repo = `liren-pruefung-${Date.now()}`;
await erzeuge('bob', '/user/repos', {name: repo, private: false, auto_init: true});
const issueRes = await api('bob', `/repos/bob/${repo}/issues`, json({title: 'Liren lokal prüfen', body: 'Öffentliche Aufgabe von Bob.'}));
assert.equal(issueRes.status, 201);
const issue = await issueRes.json();
const pfad = `/repos/bob/${repo}`;
assert.equal((await api('bob', `${pfad}/collaborators/alice`, json({permission: 'write'}, 'PUT'))).status, 204);
const alice = await anmelden('alice');
const bob = await anmelden('bob');
const carol = await anmelden('carol');
const webIssue = `/bob/${repo}/issues/${issue.number}`;
await setze({offen: false});
await pruefe('API: geschlossenes Tor schreibt keinen Kommentar', async () => {
  const res = await api('alice', `${pfad}/issues/${issue.number}/comments`, json({body: 'Gesperrter Kommentar.'}));
  assert.equal(res.status, 403); assert.equal((await res.json()).error, 'LIREN_GATE_CLOSED');
  assert.deepEqual(await (await api('bob', `${pfad}/issues/${issue.number}/comments`)).json(), []);
});
await pruefe('Web: geschlossenes Tor schützt den nativen Formularweg', async () => {
  const html = await (await alice(webIssue)).text();
  assert.ok(html.includes('liren-gate'));
  const res = await alice(`${webIssue}/comments`, {method: 'POST', body: new URLSearchParams({content: 'Web-Umgehung.'})});
  assert.equal(res.status, 403);
});
await setze({offen: true});
const created = await api('alice', `${pfad}/issues/${issue.number}/comments`, json({body: 'Angekommener Kommentar.'}));
assert.equal(created.status, 201); const comment = await created.json();
await pruefe('Torende bestätigt einen tatsächlich gespeicherten Kommentar', async () => {
  const res = await bob(`/liren/issues/${issue.id}/constellation-ticket`, json({otherUserId: '2', gate: {name: 'issue-comments', side: 'end'}}));
  assert.equal(res.status, 200); assert.equal((await res.json()).ticket.surface, 'constellation');
});
await pruefe('Ein drittes Konto bestätigt keine fremde Ankunft', async () => {
  const res = await carol(`/liren/issues/${issue.id}/constellation-ticket`, json({otherUserId: '2', gate: {name: 'issue-comments', side: 'end'}, to: '1', userId: '1'}));
  assert.equal(res.status, 400);
});
await setze({offen: false});
await pruefe('API: Bearbeitung bleibt gesperrt und bewahrt den alten Text', async () => {
  const res = await api('alice', `${pfad}/issues/comments/${comment.id}`, json({body: 'Umgehung durch Bearbeitung.'}, 'PATCH'));
  assert.equal(res.status, 403);
  assert.equal((await (await api('bob', `${pfad}/issues/comments/${comment.id}`)).json()).body, 'Angekommener Kommentar.');
});
await pruefe('Auch der ältere API-Eingang schützt Bearbeitungen', async () => {
  assert.equal((await api('alice', `${pfad}/issues/${issue.number}/comments/${comment.id}`, json({body: 'Älterer Eingang.'}, 'PATCH'))).status, 403);
});
await pruefe('Web: unveränderter Text erlaubt keine Anhang-Umgehung', async () => {
  const res = await alice(`/bob/${repo}/comments/${comment.id}`, {method: 'POST', body: new URLSearchParams({content: comment.body, content_version: '0', 'files[]': 'erfundener-anhang'})});
  assert.equal(res.status, 403);
});
await pruefe('Web: Textbearbeitung bleibt ebenfalls gesperrt', async () => {
  const res = await alice(`/bob/${repo}/comments/${comment.id}`, {method: 'POST', body: new URLSearchParams({content: 'Web-Bearbeitung.', content_version: '0', ignore_attachments: 'true'})});
  assert.equal(res.status, 403);
});
const anhang = () => { const form = new FormData(); form.append('attachment', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')], {type: 'image/png'}), 'probe.png'); return form };
await pruefe('API: gesperrter Upload hinterlässt keinen neuen Anhang', async () => {
  const res = await api('alice', `${pfad}/issues/comments/${comment.id}/assets`, {method: 'POST', body: anhang()});
  assert.equal(res.status, 403);
  assert.deepEqual(await (await api('bob', `${pfad}/issues/comments/${comment.id}/assets`)).json(), []);
});
await setze({offen: true});
const upload = await api('alice', `${pfad}/issues/comments/${comment.id}/assets`, {method: 'POST', body: anhang()});
assert.equal(upload.status, 201); const asset = await upload.json();
await setze({offen: false});
await pruefe('Umbenennen eines Anhangs ist bei geschlossenem Tor gesperrt', async () => {
  assert.equal((await api('alice', `${pfad}/issues/comments/${comment.id}/assets/${asset.id}`, json({name: 'Neuer Inhalt.png'}, 'PATCH'))).status, 403);
  assert.equal((await (await api('bob', `${pfad}/issues/comments/${comment.id}/assets`)).json())[0].name, 'probe.png');
});
await pruefe('Auch der Aufgaben-Anhang-Eingang schützt einen Kommentar-Anhang', async () => {
  assert.equal((await api('alice', `${pfad}/issues/${issue.number}/assets/${asset.id}`, json({name: 'Anderer Eingang.png'}, 'PATCH'))).status, 403);
  assert.equal((await (await api('bob', `${pfad}/issues/comments/${comment.id}/assets`)).json())[0].name, 'probe.png');
});
await pruefe('Aufgabenstatus bleibt bei geschlossenem Kommentartor bedienbar', async () => {
  const html = await (await alice(webIssue)).text();
  assert.match(html, /<form[^>]*action="[^"]*\/comments"[^>]*>[\s\S]*?name="status"[\s\S]*?<\/form>/);
  const res = await alice(`${webIssue}/comments`, {method: 'POST', body: new URLSearchParams({status: 'close'})});
  assert.equal(res.status, 200);
  assert.equal((await (await api('bob', `${pfad}/issues/${issue.number}`)).json()).state, 'closed');
  assert.equal((await (await api('bob', `${pfad}/issues/${issue.number}/comments`)).json()).length, 1);
});
await pruefe('Öffentliche Inhalte bleiben anonym lesbar', async () => {
  const html = await (await fetch(`${basis}${webIssue}`)).text();
  assert.ok(html.includes('Öffentliche Aufgabe von Bob.')); assert.ok(html.includes('Angekommener Kommentar.'));
  assert.ok(!html.includes('<liren-gate'));
});
await setze({ausfall: true});
await pruefe('Ausfall sperrt die Aktion vor dem Schreiben', async () => {
  const res = await api('alice', `${pfad}/issues/${issue.number}/comments`, json({body: 'Bei Ausfall.'}));
  assert.equal(res.status, 503);
  assert.equal((await (await api('bob', `${pfad}/issues/${issue.number}/comments`)).json()).length, 1);
});
await setze({offen: true});
await pruefe('Entzogene Leserechte sperren die Liren-Route vor dem SDK', async () => {
  assert.equal((await api('bob', pfad, json({private: true}, 'PATCH'))).status, 200);
  const res = await carol(`/liren/issues/${issue.id}/constellation-ticket`, json({otherUserId: '2', gate: {name: 'issue-comments', side: 'end'}}));
  assert.equal(res.status, 404);
  assert.deepEqual((await (await fetch(kontrolle)).json()).aufrufe, []);
});
await pruefe('Gelöschter Kommentar bestätigt keine Ankunft mehr', async () => {
  assert.equal((await api('alice', `${pfad}/issues/comments/${comment.id}`, {method: 'DELETE'})).status, 204);
  const res = await bob(`/liren/issues/${issue.id}/constellation-ticket`, json({otherUserId: '2', gate: {name: 'issue-comments', side: 'end'}}));
  assert.equal(res.status, 400);
});
await pruefe('Fremde Web-Herkunft wird vor dem Einbau abgewiesen', async () => {
  const res = await fetch(`${basis}/liren/issues/${issue.id}/self-ticket`, {...json({}), headers: {'Content-Type': 'application/json', Origin: 'https://fremd.invalid', 'Sec-Fetch-Site': 'cross-site'}});
  assert.equal(res.status, 403);
});
console.info(`${schritte} tatsächliche Gitea-HTTP-Übergänge geprüft; Liren-API simuliert.`);
