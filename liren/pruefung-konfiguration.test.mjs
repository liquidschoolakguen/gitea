import assert from 'node:assert/strict';
import test from 'node:test';
import {pruefUmgebung} from './pruefung-konfiguration.mjs';

test('Prüfung bekommt eigene Ports, Images und einen eigenen Projektnamen', () => {
  const env = pruefUmgebung({projekt: 'liren-pruefung-123abc', port: 23400, kontrollPort: 23404,
    image: 'liren-gitea:pruefung-123abc', dienstImage: 'liren-gitea-dienst:pruefung-123abc'});
  assert.equal(env.LIREN_PRUEF_PROJEKT, 'liren-pruefung-123abc');
  assert.equal(env.LIREN_PRUEF_PORT, '23400');
  assert.equal(env.LIREN_PRUEF_KONTROLL_PORT, '23404');
  assert.equal(env.LIREN_PRUEF_IMAGE, 'liren-gitea:pruefung-123abc');
});

test('Prüfung weist fremde Images, Vorführprojekte und unzulässige Ports ab', () => {
  const gut = {projekt: 'liren-pruefung-123abc', port: 23400, kontrollPort: 23404,
    image: 'liren-gitea:pruefung-123abc', dienstImage: 'liren-gitea-dienst:pruefung-123abc'};
  for (const falsch of [{projekt: 'liren-gitea'}, {projekt: '../dev'}, {port: 3300},
    {port: 80}, {port: '23400;echo'}, {kontrollPort: 23400},
    {image: 'fremd/gitea:latest'}, {dienstImage: 'liren-gitea-dienst:latest'}]) {
    assert.throws(() => pruefUmgebung({...gut, ...falsch}), /Ungültige/u);
  }
});
