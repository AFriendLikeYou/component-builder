(() => {
  // Posteingang für Nachrichten von KI-Agenten. Ungelesene tragen einen kleinen Akzentpunkt.
  const unread = d => d.messages.filter(m => m.unread).length;

  const head = (d, h) => `
    <div class="ib-head" data-area="text:kopf">
      <p class="ib-title"><span class="t-16 w-500">${h.esc(d.title)}</span><span class="t-12 ink-2">${unread(d)} ungelesen</span></p>
      <button class="btn-pill ib-search t-12 ink-2" data-area="control:suche" aria-label="Posteingang durchsuchen">${h.icon('search', 16)}<span>Suche</span></button>
    </div>`;

  const dot = m => (m.unread ? '<span class="ib-dot" aria-label="ungelesen"></span>' : '');
  const thumbs = (m, h) => `
    <div class="ib-thumbs" data-area="media:anhang">
      ${Array.from({ length: m.media }, (_, i) => h.media(i, { class: 'ib-thumb' })).join('')}
    </div>`;

  Factory.register({
    id: 'inbox',
    name: 'Posteingang',
    aliases: ['inbox', 'posteingang', 'nachrichten', 'mail', 'agenten', 'messages'],
    data: {
      title: 'Posteingang',
      messages: [
        { from: 'Recherche-Agent', icon: 'bookmark', time: '14:40', unread: true, text: 'Drei Hamburger Geschichten mit den wichtigsten Details und Quellen', line: 'Drei Hamburger Geschichten mit Quellen' },
        { from: 'Motion-Agent', icon: 'grid', time: '14:32', media: 3, text: 'Inhalte kommen und gehen unabhängig; jede Fläche bewegt sich im gleichen Tempo', line: 'Jede Fläche im gleichen Tempo' },
        { from: 'Wetter-Agent', icon: 'sun', time: '14:18', unread: true, text: 'Aktuelle Lage und die Fünf-Tage-Vorhersage an einem Ort', line: 'Aktuelle Lage und Fünf-Tage-Vorhersage' },
        { from: 'Kalender-Agent', icon: 'calendar', time: '13:55', text: 'Zwei Termine morgen verschoben, der Vormittag bleibt frei', line: 'Zwei Termine morgen verschoben' },
        { from: 'Schreib-Agent', icon: 'edit', time: '13:20', text: 'Der Entwurf für den Newsletter liegt zur Durchsicht bereit', line: 'Der Newsletter-Entwurf liegt bereit' },
      ],
    },
    css: `
      .ib { display: flex; flex-direction: column; gap: 16px; }
      .ib-head { height: 32px; display: flex; align-items: center; justify-content: space-between; }
      .ib-title { display: flex; align-items: baseline; gap: 8px; }
      .ib-search { width: 88px; padding: 0; justify-content: center; }
      .ib-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c-accent); }
      .ib-line { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
      .ib-thumbs { display: flex; gap: 8px; }
      .ib-thumb { border-radius: var(--r-8); flex: none; }

      /* Agenten: Liste mit zweizeiliger Vorschau */
      .ib-list { display: flex; flex-direction: column; gap: 16px; }
      .ib-msg { display: grid; grid-template-columns: 16px 1fr; }
      .ib-msg > * { grid-column: 2; }
      .ib-msg > .ib-dot { grid-column: 1; grid-row: 1; align-self: center; }
      /* Inters optische Laufweite bei 14 px (−0,006 em); die Klammer ist nur Rückfall, falls ein Browser breiter setzt */
      .ib-prev { letter-spacing: -0.006em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .ib-msg .ib-thumbs { margin-top: 8px; }
      .ib-msg .ib-thumb { width: 32px; height: 32px; }

      /* Kompakt: Absender-Symbol + eine Zeile */
      .ib-rows { display: flex; flex-direction: column; gap: 16px; }
      .ib-row { height: 32px; display: flex; align-items: center; gap: 16px; }
      .ib-ava { position: relative; width: 32px; height: 32px; border-radius: 50%; flex: none; display: grid; place-items: center; background: var(--c-fill); color: var(--c-ink-2); }
      .ib-ava .ib-dot { position: absolute; top: -1px; right: -1px; box-shadow: 0 0 0 2px var(--c-surface); }

      /* Im Fokus: eine Nachricht groß, die übrigen als Leiste */
      .ib-f { display: flex; flex-direction: column; }
      .ib-f .ib-head { margin-bottom: 24px; }
      .ib-focus { display: flex; flex-direction: column; gap: 16px; }
      .ib-from { height: 32px; display: flex; align-items: center; gap: 16px; }
      .ib-f .ib-thumbs { margin-top: 16px; }
      .ib-f .ib-thumb { width: 96px; height: 96px; }
      .ib-bar { margin-top: 24px; height: 48px; border-radius: var(--r-pill); background: var(--c-fill); display: flex; align-items: center; gap: 16px; padding: 0 8px 0 16px; }
      .ib-bar .btn-text { min-width: 0; color: var(--c-ink); }
      .ib-bar .btn-text .ib-dot { flex: none; }
      .ib-bar .btn-round { flex: none; margin-left: auto; background: var(--c-surface); }
    `,
    layouts: [
      {
        id: 'agenten',
        name: 'Agenten',
        idea: 'Die Liste führt: jede Nachricht mit Absender, Uhrzeit und zwei Zeilen Vorschau, Ungelesenes am blauen Punkt.',
        height: 384,
        render: (d, h) => `
          <div class="ib">
            ${head(d, h)}
            <div class="ib-list" data-area="text:liste">
              ${d.messages.slice(0, 3).map((m, i) => `
                <div class="ib-msg" data-area="text:nachricht-${i + 1}">
                  ${dot(m)}
                  <div class="ib-line"><p class="t-14 w-500 clip">${h.esc(m.from)}</p><p class="t-12 ink-2 num">${m.time}</p></div>
                  <p class="t-14 ink-2 ib-prev">${h.esc(m.text)}</p>
                  ${m.media ? thumbs(m, h) : ''}
                </div>`).join('')}
            </div>
          </div>`,
      },
      {
        id: 'kompakt',
        name: 'Kompakt',
        idea: 'Wer hat geschrieben: Absender-Symbole führen, jede Nachricht ist auf eine Zeile gekürzt – fünf passen, wo sonst drei stehen.',
        height: 320,
        render: (d, h) => `
          <div class="ib">
            ${head(d, h)}
            <div class="ib-rows" data-area="text:liste">
              ${d.messages.map((m, i) => `
                <div class="ib-row" data-area="text:nachricht-${i + 1}">
                  <span class="ib-ava">${h.icon(m.icon, 16)}${dot(m)}</span>
                  <div class="stack grow">
                    <div class="ib-line"><p class="t-14 tight w-500 clip">${h.esc(m.from)}</p><p class="t-12 ink-2 num">${m.time}</p></div>
                    <p class="t-12 ink-2 clip">${h.esc(m.line)}</p>
                  </div>
                </div>`).join('')}
            </div>
          </div>`,
      },
      {
        id: 'fokus',
        name: 'Im Fokus',
        idea: 'Eine Nachricht füllt die Karte, mit großem Text und Bildern; die übrigen warten als schmale Leiste darunter.',
        height: 408,
        render: (d, h) => {
          const three = d.messages.slice(0, 3);
          const m = three.find(x => x.media) || three[0];
          const rest = three.filter(x => x !== m);
          return `
          <div class="ib-f">
            ${head(d, h)}
            <div class="ib-focus" data-area="text:nachricht">
              <div class="ib-from"><span class="ib-ava">${h.icon(m.icon, 16)}</span><p class="t-16 w-500 grow">${h.esc(m.from)}</p><p class="t-12 ink-2 num">${m.time}</p></div>
              <p class="t-20">${h.esc(m.text)}</p>
            </div>
            ${m.media ? thumbs(m, h) : ''}
            <div class="ib-bar" data-area="control:weitere">
              ${rest.map(x => `<button class="btn-text t-12 w-500">${dot(x)}<span class="clip">${h.esc(x.from)}</span></button>`).join('')}
              <button class="btn-round sm" aria-label="Alle Nachrichten">${h.icon('chevron-right', 16)}</button>
            </div>
          </div>`;
        },
      },
    ],
  });
})();
