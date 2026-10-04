# Gitea mit Liren — lokale Vorführung

Der Ausgangspunkt ist Gitea `v28.0.0`, Commit
`15b8a5805adf57c5189602008d38cccfd3c795e0`. Gitea bleibt eine eigenständige App.
Der Go-Anschluss reicht ausschließlich fertige Antworten des zusätzlichen
Liren-Dienstes durch. Die Liren-Flächen kommen aus dem gepackten SDK.

## Vorbereitung

Benötigt werden Docker, Node 22 und ein zugänglicher fester Liren-Checkout.
Das SDK muss darin gebaut sein. Die Paketvorbereitung hält Commit und Paketbytes
in `stand.json` fest; Paketinhalt und Zugangsdaten werden nicht eingecheckt.

```text
node liren/vorbereiten.mjs <Pfad zum Liren-Checkout>
node liren/einrichten.mjs gitea-lokal <Datei mit dem eigenen lokalen Test-Schlüssel>
docker volume create liren-gitea-dev
docker compose --env-file .liren-lokal/.env -f liren/compose.yml up -d --build
node liren/beispieldaten.mjs
```

In der lokalen Liren Console braucht diese App die Tore `issue-comments`
(Kommentare: „Der Person, die die Aufgabe eröffnet hat, einen Kommentar schreiben.“)
und `issue-publications` (Aufgaben: „Öffentliche Aufgaben einer anderen Person lesen.“).
Die Web-Adresse lautet `http://127.0.0.1:3300`. Liren-Server und Widget-Origin
müssen lokal laufen; Produktion wird dafür nicht aktiviert.

Gitea öffnet unter `http://127.0.0.1:3300`. Die normalen Gitea-Konten und die
Liren-Anmeldung sind getrennt. In dieser Vorführung gehören Kommentare an die
Person, die die Aufgabe eröffnet hat; weitere Leser sind keine zusätzlichen
Empfänger. Aufgaben bleiben öffentlich lesbar. Private Aufgaben verlangen vor
jedem Liren-Aufruf weiterhin das Gitea-Leserecht.

Die synthetischen Konten heißen `alice`, `bob` und `carol`; ihr öffentliches
Testpasswort ist `LirenDemo2026!`. Bob verwaltet ausschließlich diese lokale
Vorführung. Beispieldaten werden über die gewöhnliche Gitea-API erzeugt;
der Wiederanlauf erzeugt dieselbe Aufgabe nicht nochmals.

## Automatische Prüfung

```text
node --test liren/pruefung-konfiguration.test.mjs liren/pruef-lauf.test.mjs
node liren/pruefen.mjs
```

Jeder Lauf verwendet eigene freie Ports, einen eigenen Compose-Projektnamen
und eigene Image-Verweise. Auch bei Fehler oder Abbruch werden ausschließlich
seine Container und sein Prüfvolume entfernt. Die Vorführung und deren Daten
bleiben erhalten. Die Images müssen vorher lokal gebaut sein; bei einem
Nachzug wählt die Steuerung die frisch gebauten Images über
`LIREN_PRUEF_QUELL_IMAGE` und `LIREN_PRUEF_QUELL_DIENST_IMAGE`.

Die Prüfung verwendet eine eigene Datenbank, synthetische Konten und die
simulierte zentrale Liren-API. Der zusätzliche Dienst und das Go-Paket sind
die echten vorbereiteten Pakete. Web-Anmeldung, Schreiben, Bearbeiten,
Anhänge, Ankunft und Leserechte werden über tatsächliche Gitea-HTTP-Routen
geprüft. Diese Prüfung ersetzt keinen Durchlauf mit unabhängigen Liren-Konten.

## Umfang und Grenzen

Das Kommentartor schützt normale neue Kommentare, neue Texte bestehender
Kommentare und neue oder umbenannte Anhänge. Web und API verwenden dieselbe
Schreibgrenze. Auch eingehende Kommentar-E-Mails erreichen diesen Service;
Mail ist in der lokalen Vorführung nicht eingerichtet. Löschungen behalten die
vorhandenen Gitea-Rechte. Reviews, Commits, Git-Pushes, Aufgabenänderungen und
Benachrichtigungen sind keine zusätzlichen eingebauten Liren-Funktionen.

Die Ankunft am Kommentarende folgt aus einem gespeicherten normalen Kommentar
in derselben lesbaren Aufgabe. Eine Behauptung aus dem Browser genügt nicht.
Bestandsimporte haben einen eigenen Eingang und sind deshalb bei aktiviertem
Liren zwingend abgeschaltet. Aktionen, Registrierung und SSH bleiben im lokalen
Start ebenfalls abgeschaltet. Es gibt keinen Anspruch auf eine vollständige
Liren-Absicherung sämtlicher Gitea-Funktionen.

Zum Wiederanlauf denselben Compose-Aufruf ohne `--build` verwenden. Das Volume
und `.liren-lokal/.env` bleiben erhalten; insbesondere der Referenzschlüssel darf
nicht bei jedem Start neu entstehen. Beenden: `docker compose --env-file
.liren-lokal/.env -f liren/compose.yml stop`. Keine Volumes löschen.

## Belegter Stand am 04.10.2026

Der lokale Image-Build und 17 tatsächliche Gitea-HTTP-Übergänge sind geprüft.
Die HTTP-Prüfung verwendet die simulierte zentrale API; sie deckt Web und API,
beide Zugänge zum Umbenennen eines Kommentar-Anhangs, Ausfall, entzogene
Leserechte und gelöschte Kommentare ab. Eine reine Statusänderung erzeugt
bei geschlossenem Kommentartor keinen zusätzlichen Kommentar.

Im echten Browser sind normale Gitea-Anmeldung, die Liren-Anmeldeseite am
Widget-Origin, lesbare Absätze und der Erhalt des Kommentartors nach dem
Speichern geprüft. [Die Aufgabenansicht](bilder/gitea-liren.png) zeigt die lokale
Vorführung. Der Wiederanlauf erhält die gespeicherten Konten und die Aufgabe.

Offen bleiben der vollständige Inhaltsablauf mit zwei unabhängigen Liren-Konten
und Mithats Sichtung. Das private SDK kommt weiterhin aus dem festen lokalen
Checkout. Öffentlicher Paketbezug, Fork-CI und unbeaufsichtigte Fork-Pflege
sind noch nicht eingerichtet. Keine Veröffentlichung oder Produktionsfreigabe.
