import {pruefUmgebung} from './pruefung-konfiguration.mjs';

export function abbruchSteuerung() {
  let child;
  let aufraeumen = false;
  let abgebrochen = false;
  return {
    get abgebrochen() {return abgebrochen},
    setze(prozess, cleanup) {child = prozess; aufraeumen = cleanup},
    abbrechen() {abgebrochen = true; if (!aufraeumen && child && child.exitCode === null) child.kill('SIGTERM');},
  };
}

export async function pruefeIsoliert({token, port, kontrollPort, node, quellen, run}) {
  const projekt = `liren-pruefung-${token}`;
  const env = pruefUmgebung({projekt, port, kontrollPort,
    image: `liren-gitea:pruefung-${token}`, dienstImage: `liren-gitea-dienst:pruefung-${token}`});
  const compose = ['compose', '-p', projekt, '-f', 'liren/compose.pruefung.yml'];
  const schritt = (programm, args, aufraeumen = false) => run(programm, args, {env, aufraeumen});
  let fehler;
  try {
    await schritt('docker', ['image', 'tag', quellen[0], env.LIREN_PRUEF_IMAGE]);
    await schritt('docker', ['image', 'tag', quellen[1], env.LIREN_PRUEF_DIENST_IMAGE]);
    await schritt('docker', [...compose, 'up', '-d', '--pull', 'never']);
    await schritt(node, ['liren/http-pruefung.mjs']);
  } catch (error) {fehler = error} finally {
    for (const args of [[...compose, 'down', '--volumes'],
      ['image', 'rm', env.LIREN_PRUEF_IMAGE], ['image', 'rm', env.LIREN_PRUEF_DIENST_IMAGE]]) {
      try {await schritt('docker', args, true)} catch (error) {fehler = fehler ? new AggregateError([fehler, error], `${fehler.message}; ${error.message}`) : error}
    }
  }
  if (fehler instanceof Error) throw fehler;
  if (fehler) throw new Error('Die Prüfung lieferte keinen lesbaren Fehler.', {cause: fehler});
}
