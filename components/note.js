(() => {
  // Schnellnotiz. Libre Baskerville ist der Akzent: der Notiztext selbst, nie die Oberfläche drumherum.
  const chip = (d, h) => `<span class="chip mark t-12">${h.esc(d.status)}</span>`;

  Factory.register({
    id: 'note',
    name: 'Notiz',
    aliases: ['note', 'notiz', 'notizen', 'memo', 'checkliste', 'zitat', 'quote'],
    data: {
      title: 'Schnellnotiz',
      edited: 'Heute, 14:40',
      text: 'Lass ein wenig Raum für das Unerwartete.',
      status: 'Entwurf · diese Sitzung',
      checks: [
        { text: 'Fragen an die Redaktion sammeln', done: true },
        { text: 'Bilder für den Aufmacher sichten', done: true },
        { text: 'Zitat freigeben lassen', done: false },
        { text: 'Text bis 16 Uhr abgeben', done: false },
      ],
      quote: {
        before: '„Wer ', mark: 'das Unerwartete', after: ' nicht erwartet, wird es nicht finden.“',
        source: 'Heraklit, Fragment B 18',
      },
    },
    css: `
      .no { display: flex; flex-direction: column; gap: 16px; }
      .no-head { display: flex; align-items: baseline; justify-content: space-between; }
      .no-field { background: var(--c-fill); border-radius: var(--r-16); padding: 16px; }
      .no-foot { display: flex; }

      /* Checkliste */
      .no-checks { display: flex; flex-direction: column; gap: 8px; padding: 8px 16px; }

      /* Zitat */
      .no-q { gap: 24px; }
      .no-q .no-head { align-items: center; }
      .no-mark { background: linear-gradient(transparent 58%, var(--c-highlight) 58%, var(--c-highlight) 92%, transparent 92%); color: inherit; }
      .no-src { display: flex; align-items: center; gap: 16px; }
      .no-rule { width: 24px; height: 1px; background: var(--c-ink-3); flex: none; }
    `,
    layouts: [
      {
        id: 'notiz',
        name: 'Notiz',
        idea: 'Der Gedanke zuerst: ein Satz in Baskerville auf ruhigem Grau, darunter nur der Status.',
        height: 224,
        render: (d, h) => `
          <div class="no">
            <div class="no-head" data-area="text:kopf">
              <p class="t-16 w-500">${h.esc(d.title)}</p>
              <p class="t-12 ink-2 num">${h.esc(d.edited)}</p>
            </div>
            <div class="no-field" data-area="text:notiz">
              <p class="t-24 serif">${h.esc(d.text)}</p>
            </div>
            <div class="no-foot" data-area="meta:status">${chip(d, h)}</div>
          </div>`,
      },
      {
        id: 'checkliste',
        name: 'Checkliste',
        idea: 'Was noch zu tun ist: vier Punkte zum Abhaken, Erledigtes tritt grau zurück.',
        height: 296,
        render: (d, h) => {
          const done = d.checks.filter(c => c.done).length;
          return `
          <div class="no">
            <div class="no-head" data-area="text:kopf">
              <p class="t-16 w-500">${h.esc(d.title)}</p>
              <p class="t-12 ink-2 num">${done} von ${d.checks.length} erledigt</p>
            </div>
            <div class="no-field no-checks" data-area="control:checkliste">
              ${d.checks.map((c, i) => `
                <button class="check${c.done ? ' is-done' : ''}" role="checkbox" aria-checked="${c.done}" data-area="control:punkt-${i + 1}">
                  <span class="check-box">${h.icon('check', 14)}</span>
                  <span class="t-14 clip check-label">${h.esc(c.text)}</span>
                </button>`).join('')}
            </div>
            <div class="no-foot" data-area="meta:status">${chip(d, h)}</div>
          </div>`;
        },
      },
      {
        id: 'zitat',
        name: 'Zitat',
        idea: 'Ein großer Satz, sonst fast nichts: das Zitat in Baskerville, die markierte Stelle gelb, die Quelle leise darunter.',
        height: 304,
        render: (d, h) => {
          const q = d.quote;
          return `
          <div class="no no-q">
            <div class="no-head" data-area="meta:kopf">
              <p class="t-12 w-500 ink-2">${h.esc(d.title)}</p>
              ${chip(d, h)}
            </div>
            <blockquote data-area="text:zitat">
              <p class="t-32 serif">${h.esc(q.before)}<mark class="no-mark">${h.esc(q.mark)}</mark>${h.esc(q.after)}</p>
            </blockquote>
            <div class="no-src" data-area="meta:quelle">
              <span class="no-rule"></span><p class="t-14 ink-2">${h.esc(q.source)}</p>
            </div>
          </div>`;
        },
      },
    ],
  });
})();
