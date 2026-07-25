import { Runtime, Url } from 'foldkit';

import { ChangedUrl, Message, Model, RequestedUrl, routingInit, update, view } from './main';
import './styles.css';
import { initializeThemePreference } from './theme';

initializeThemePreference();

const application = Runtime.makeApplication({
  Model,
  init: routingInit,
  update,
  view,
  routing: {
    onUrlRequest: (request) =>
      request._tag === 'External'
        ? RequestedUrl({ href: request.href, external: true })
        : RequestedUrl({ href: Url.toString(request.url), external: false }),
    onUrlChange: (url) => ChangedUrl({ href: Url.toString(url) }),
  },
  container: document.getElementById('root'),
  /**
   * Handing the runtime the Message schema lets the DevTools MCP server read
   * the live Model and message history, and dispatch messages into a running
   * tab. It is how an agent can inspect state that already exists instead of
   * rebuilding it through the interface to look at it.
   */
  devTools: {
    Message,
  },
});

Runtime.run(application);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
