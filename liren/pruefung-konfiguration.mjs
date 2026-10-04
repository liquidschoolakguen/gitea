export function pruefUmgebung({projekt, port, kontrollPort, image, dienstImage}) {
  const ports = [port, kontrollPort];
  if (!/^liren-pruefung-[a-z0-9]{6,32}$/u.test(projekt ?? '') ||
    ports.some((wert) => !Number.isInteger(wert) || wert < 10000 || wert > 65535) || port === kontrollPort ||
    !/^liren-gitea:pruefung-[a-z0-9]{6,32}$/u.test(image ?? '') ||
    !/^liren-gitea-dienst:pruefung-[a-z0-9]{6,32}$/u.test(dienstImage ?? '')) {
    throw new Error('Ungültige isolierte Prüfkonfiguration.');
  }
  return {LIREN_PRUEF_PROJEKT: projekt, LIREN_PRUEF_PORT: String(port),
    LIREN_PRUEF_KONTROLL_PORT: String(kontrollPort), LIREN_PRUEF_IMAGE: image,
    LIREN_PRUEF_DIENST_IMAGE: dienstImage};
}
