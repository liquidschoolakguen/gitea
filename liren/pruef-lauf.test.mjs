import assert from 'node:assert/strict';
import test from 'node:test';
import {pruefeIsoliert, abbruchSteuerung} from './pruef-lauf.mjs';

test('Ein zweiter Abbruch unterbricht das Freigeben der eigenen Daten nicht', () => {
  const steuerung = abbruchSteuerung();
  let beendet = 0;
  const child = {exitCode: null, kill() {beendet += 1}};
  steuerung.setze(child, false);
  steuerung.abbrechen();
  assert.equal(beendet, 1);
  assert.equal(steuerung.abgebrochen, true);
  steuerung.setze(child, true);
  steuerung.abbrechen();
  assert.equal(beendet, 1);
});

test('Gescheiterter Start räumt ausschließlich den eigenen Prüfstand auf', async () => {
  const aufrufe = [];
  await assert.rejects(pruefeIsoliert({token: '123abc', port: 23400, kontrollPort: 23404,
    node: 'node', quellen: ['liren-gitea:28.0.0', 'liren-gitea-dienst:0.28.0'],
    run: (programm, args, optionen) => {
      aufrufe.push({programm, args, optionen});
      if (args.includes('up')) throw new Error('Startfehler');
    }}), /Startfehler/u);
  assert.ok(aufrufe.some(({args}) => args.includes('down') && args.includes('--volumes')));
  assert.equal(aufrufe.filter(({args}) => args.includes('rm')).length, 2);
  assert.ok(aufrufe.every(({args}) => !args.includes('liren-gitea-dev') && !args.includes('liren-gitea')));
  assert.ok(aufrufe.filter(({args}) => args.includes('down') || args.includes('rm')).every(({optionen}) => optionen.aufraeumen));
});

test('Aufräumfehler werden sichtbar, weitere eigene Ressourcen trotzdem freigegeben', async () => {
  const aufrufe = [];
  await assert.rejects(pruefeIsoliert({token: '123abc', port: 23400, kontrollPort: 23404,
    node: 'node', quellen: ['liren-gitea:28.0.0', 'liren-gitea-dienst:0.28.0'],
    run: (_programm, args) => {aufrufe.push(args); if (args.includes('down')) throw new Error('Aufräumen gescheitert');}}),
  /Aufräumen gescheitert/u);
  assert.equal(aufrufe.filter((args) => args.includes('rm')).length, 2);
});
