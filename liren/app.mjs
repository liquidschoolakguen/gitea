import {createLirenEinrichtung} from './sdk/embed.js';

const config = document.querySelector('#liren-app-config');
if (config?.getAttribute('data-user-id')) {
  const liren = createLirenEinrichtung({
    app: config.getAttribute('data-app'),
    serverUrl: `/liren/issues/${config.getAttribute('data-issue-id')}`,
    widgetOrigin: config.getAttribute('data-widget-origin'),
    session: () => config.getAttribute('data-user-id'),
    onError: (fehler) => console.error(fehler.message),
  });
  window.addEventListener('pagehide', () => liren.destroy(), {once: true});
  window.addEventListener('focus', async () => {
    try {
      const res = await fetch('/liren/ich', {credentials: 'same-origin', cache: 'no-store'});
      if (res.ok && (await res.json()).userId !== config.getAttribute('data-user-id')) window.location.reload();
    } catch {
      // Ohne Verbindung bleibt die serverseitige Kommentarsperre maßgeblich.
    }
  });
}
