(() => {
  // Persönliche Leseliste: Vorschläge nach den gewählten Themen. Akzentfarbe nur für das Persönliche
  // (gewählte Themen, der Grund für einen Vorschlag, angefangene Artikel).
  // Zustände (h.state): „loading“ = Skelett in denselben Flächen und Maßen, „empty“ und „error“ = Meldung mit genau einer Handlung.
  // Hover hebt hervor, was man bedienen kann; die Stile hängen an .is-hover (Vorschau) und :hover.
  const left = a => (a.left != null ? a.left : a.min);
  const kicker = (a, h) => a.left != null
    ? `<span class="re-acc w-500">Angefangen</span> · noch ${a.left} Min.`
    : `<span class="w-500">${h.esc(a.topic)}</span> · ${a.min} Min.`;
  const why = (a, h) => a.left != null ? kicker(a, h) : `<span class="re-acc w-500">Weil du ${h.esc(a.topic)} folgst</span> · ${a.min} Min.`;

  // short = Unterzeile in der Listenzeile · w = feste Breite der Handlung dort (ohne Icon, damit der Text daneben Platz hat)
  const MSG = {
    empty: { icon: 'bookmark', title: 'Noch keine Vorschläge', text: 'Wähle Themen, die dich interessieren', short: 'Wähle deine Themen', action: 'Themen wählen', actIcon: 'plus', w: 128 },
    error: { icon: 'close', title: 'Nicht geladen', text: 'Prüfe deine Verbindung', short: 'Prüfe deine Verbindung', action: 'Erneut versuchen', actIcon: 'refresh', w: 136, error: true },
  };
  const msgOf = (d, h) => MSG[h.state] || (h.state !== 'loading' && !d.articles.length ? MSG.empty : null);
  const sk = (lh, w) => `<span class="re-sk" style="height:${lh}px;--w:${w}"></span>`;
  const bone = (w, ht) => `<span class="re-bone" style="width:${w};height:${ht}px"></span>`;
  const tile = (h, m, cls, area, { size = 24, bleed } = {}) =>
    `<div class="${cls} re-tile${m && m.error ? ' is-error' : ''}"${bleed ? ' data-bleed' : ''}${area ? ` data-area="${area}"` : ''}>${m ? h.icon(m.icon, size) : ''}</div>`;
  const act = (h, m, cls = '') => `<div class="re-acts${cls}" data-area="control:aktion"><button class="btn-pill lg solid t-14 w-500">${h.icon(m.actIcon, 16)}${m.action}</button></div>`;
  const note = (h, m, size = 't-16') => `
    ${tile(h, m, 're-badge')}
    <div class="stack">
      <p class="${size} w-500">${m.title}</p>
      <p class="t-14 ink-2">${m.text}</p>
    </div>
    ${act(h, m)}`;

  Factory.register({
    id: 'reading',
    name: 'Leseliste',
    aliases: ['reading', 'leseliste', 'für dich', 'personalisierung', 'personalisierungswidget', 'empfehlungen', 'artikel', 'read later', 'später lesen'],
    states: ['hover', 'loading', 'empty', 'error'],
    data: {
      title: 'Für dich',
      fresh: 14,
      topics: [
        { name: 'Politik', on: true },
        { name: 'Wissen', on: true },
        { name: 'Digital', on: true },
        { name: 'Kultur', on: false },
        { name: 'Arbeit', on: false },
        { name: 'Sport', on: false },
      ],
      articles: [
        { topic: 'Wissen', title: 'Warum die Nordsee schneller wärmer wird als gedacht', sub: 'Das flache Meer heizt sich doppelt so schnell auf wie der Atlantik – mit Folgen für uns.', min: 8 },
        { topic: 'Digital', title: 'Wenn der Agent die Steuererklärung macht', min: 12, left: 5 },
        { topic: 'Politik', title: 'Die leise Macht der Bürgermeister', min: 6 },
        { topic: 'Wissen', title: 'Schlaf lässt sich nicht nachholen – oder doch?', min: 5 },
      ],
    },
    css: `
      .re-acc { color: var(--c-accent); }
      .re-two { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .re-link { text-decoration-thickness: 1px; text-underline-offset: 3px; }

      /* Aufmacher: randabfallendes Bild, darunter Titel und Grund */
      .re-a { display: grid; grid-template-rows: 192px 24px 72px 24px 40px; height: 100%; }
      .re-a .re-hero { grid-row: 1; }
      .re-a .re-text { grid-row: 3; margin: 0 24px; display: flex; flex-direction: column; gap: 8px; }
      .re-a .re-foot { grid-row: 5; margin: 0 24px; display: flex; gap: 16px; }
      .re-a .re-acts .btn-pill { flex: 1; }
      .re-why { flex: 1; display: flex; align-items: center; }
      .re-why .chip { gap: 8px; background: var(--c-accent-soft); color: var(--c-accent); }

      /* Liste */
      .re-l { display: flex; flex-direction: column; gap: 16px; }
      .re-head { height: 32px; display: flex; align-items: center; justify-content: space-between; }
      .re-head .re-title { display: flex; align-items: baseline; gap: 8px; }
      .re-edit { width: 96px; padding: 0; justify-content: center; }
      .re-list { display: flex; flex-direction: column; gap: 16px; }
      .re-item { height: 48px; display: flex; align-items: center; gap: 16px; }
      .re-item :is(.cf-media, .re-tile) { width: 48px; height: 48px; border-radius: 8px; flex: none; }
      .re-none { height: 240px; align-items: center; justify-content: center; gap: 16px; text-align: center; }
      .re-none .re-badge { width: 48px; height: 48px; border-radius: 999px; flex: none; }
      .re-none .re-acts { align-self: stretch; justify-content: center; }
      .re-l .re-none .re-acts { margin-top: 8px; }

      /* Themen */
      .re-t { display: flex; flex-direction: column; gap: 24px; }
      .re-t.is-msg { gap: 16px; }
      .re-t .re-head { height: 48px; align-items: flex-start; }
      .re-t .re-none { height: 168px; display: flex; flex-direction: column; }
      .re-topics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .re-topics .toggle { padding: 0 8px; }
      .re-bar { height: 48px; border-radius: 999px; background: var(--c-fill); display: flex; align-items: center; gap: 16px; padding: 0 8px; }
      .re-faces { display: flex; }
      .re-faces > * { width: 32px; height: 32px; border-radius: 999px; flex: none; box-shadow: 0 0 0 2px var(--c-fill); }
      .re-faces > * + * { margin-left: -8px; }
      .re-bar .btn-round { background: var(--c-surface); }
      .re-bar .re-bone, .re-bar .re-sk::before { background: var(--c-fill-2); }
      .re-ico { width: 32px; height: 32px; display: grid; place-items: center; flex: none; color: var(--c-ink-2); }

      /* Listenzeile: Vorschaubild, Thema und Titel, Merken */
      .re-z { display: grid; grid-template-columns: 48px minmax(0, 1fr) 40px; gap: 16px; align-items: center; height: 48px; }
      .re-z .re-thumb { width: 48px; height: 48px; border-radius: 8px; }
      .re-z > [data-area^="control"] { height: 48px; display: grid; place-items: center; }
      .re-z.is-msg { grid-template-columns: minmax(0, 1fr) auto; }
      .re-z.is-msg .re-acts { height: 32px; }
      .re-z .re-acts .btn-pill { width: 100%; justify-content: center; white-space: nowrap; }

      /* Teaser: randabfallendes Bild, Grund, Überschrift, Unterzeile */
      .re-tz { display: grid; grid-template-rows: 192px 24px 128px; height: 100%; }
      .re-tz .re-hero { grid-row: 1; }
      .re-tz .re-copy { grid-row: 3; margin: 0 24px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .re-tz .re-msg { grid-row: 3; margin: 0 24px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }

      /* Zustände: Skelett, Kacheln statt Bild, eine Handlung */
      .re-sk { display: flex; align-items: center; }
      .re-sk::before { content: ''; width: var(--w, 100%); height: 8px; border-radius: 999px; background: var(--c-fill); }
      .re-bone { display: block; flex: none; border-radius: 999px; background: var(--c-fill); }
      .re-tile { display: grid; place-items: center; background: var(--c-fill); color: var(--c-ink-3); }
      .re-tile.is-error { background: var(--c-warm-soft); color: var(--c-warm); }
      .re-acts { display: flex; }

      /* Hover: Bedienbares tritt hervor */
      .btn-round, .btn-pill, .toggle { transition: background-color .15s, box-shadow .15s, color .15s; }
      &:is(:hover, .is-hover) :is(.btn-round:not(.solid), .re-edit) { background: var(--c-fill-2); color: var(--c-ink); }
      &:is(:hover, .is-hover) :is(.btn-round.solid, .btn-pill.solid, .re-bar .btn-round) { box-shadow: 0 0 0 4px var(--c-fill-2); }
      &:is(:hover, .is-hover) :is(.re-a, .re-z, .re-tz) .re-link { text-decoration-line: underline; }
      .re-item:is(:hover, .is-pointed) .re-link { text-decoration-line: underline; }
      .toggle:not(.is-on):is(:hover, .is-pointed) { background: var(--c-fill-2); color: var(--c-ink); }
      .toggle.is-on:is(:hover, .is-pointed) { box-shadow: inset 0 0 0 1px var(--c-accent); }
    `,
    layouts: [
      {
        id: 'aufmacher',
        name: 'Aufmacher',
        family: 'karte',
        idea: 'Der beste Vorschlag zuerst: großes Bild, Titel, und darunter in Blau, warum er für dich ausgewählt wurde.',
        height: 376,
        padding: 0,
        render: (d, h) => {
          const m = msgOf(d, h), load = h.state === 'loading', a = d.articles[0];
          if (m) return `
          <div class="re-a">
            ${tile(h, m, 're-hero', 'media:bild', { size: 32, bleed: true })}
            <div class="re-text" data-area="text:artikel">
              <p class="t-12 ink-2">${h.esc(d.title)}</p>
              <div class="stack">
                <p class="t-20 w-500 clip" data-role="Titel">${m.title}</p>
                <p class="t-14 ink-2 clip">${m.text}</p>
              </div>
            </div>
            ${act(h, m, ' re-foot')}
          </div>`;
          return `
          <div class="re-a">
            ${load ? tile(h, null, 're-hero', 'media:bild', { bleed: true }) : h.media(0, { class: 're-hero', area: 'media:bild', bleed: true })}
            <div class="re-text" data-area="text:artikel">
              ${load ? `${sk(16, '40%')}<span class="stack">${sk(24, '100%')}${sk(24, '64%')}</span>` : `
              <p class="t-12 ink-2">${kicker(a, h)}</p>
              <p class="t-20 w-500 re-two re-link" data-role="Titel">${h.esc(a.title)}</p>`}
            </div>
            <div class="re-foot">
              <div class="re-why" data-area="meta:grund">
                ${load ? bone('184px', 24) : `<span class="chip t-12">${h.icon('heart', 16)}Weil du ${h.esc(a.topic)} folgst</span>`}
              </div>
              <div class="row g-8" data-area="control:aktionen">
                ${load ? bone('40px', 40).repeat(2) : `
                <button class="btn-round" aria-label="Merken">${h.icon('bookmark', 20)}</button>
                <button class="btn-round solid" aria-label="Lesen">${h.icon('arrow-right', 20)}</button>`}
              </div>
            </div>
          </div>`;
        },
      },
      {
        id: 'liste',
        name: 'Liste',
        family: 'karte',
        idea: 'Was als Nächstes zu lesen ist: vier Artikel mit Thema und Lesezeit, ein angefangener ist blau markiert.',
        height: 336,
        render: (d, h) => {
          const m = msgOf(d, h), load = h.state === 'loading';
          const count = load ? sk(16, '96px') : m && m.error ? ''
            : `<span class="t-12 ink-2 num">${m ? 0 : d.articles.length} Artikel${m ? '' : ` · ${d.articles.reduce((s, a) => s + left(a), 0)} Min.`}</span>`;
          const list = m ? `
            <div class="re-list re-none" data-area="text:liste">${note(h, m)}</div>`
            : load ? `
            <div class="re-list" data-area="text:liste">
              ${['100%', '72%', '88%', '64%'].map((w, i) => `
                <div class="re-item" data-area="text:artikel-${i + 1}">
                  ${tile(h, null, 're-thumb')}
                  <div class="stack grow">${sk(16, '40%')}${sk(16, w)}${sk(16, '48%')}</div>
                </div>`).join('')}
            </div>`
            : `
            <div class="re-list" data-area="text:liste">
              ${d.articles.map((a, i) => `
                <div class="re-item${h.state === 'hover' && i === 1 ? ' is-pointed' : ''}" data-area="text:artikel-${i + 1}">
                  ${h.media(i)}
                  <div class="stack grow">
                    <p class="t-12 ink-2 clip">${kicker(a, h)}</p>
                    <p class="t-14 tight w-500 re-two re-link">${h.esc(a.title)}</p>
                  </div>
                </div>`).join('')}
            </div>`;
          return `
          <div class="re-l">
            <div class="re-head" data-area="text:kopf">
              <p class="re-title"><span class="t-16 w-500">${h.esc(d.title)}</span>${count}</p>
              ${m ? '' : load ? bone('96px', 32) : `<button class="btn-pill re-edit t-12 ink-2" data-area="control:themen">${h.icon('edit', 16)}<span>Themen</span></button>`}
            </div>
            ${list}
          </div>`;
        },
      },
      {
        id: 'themen',
        name: 'Themen',
        family: 'karte',
        idea: 'Personalisieren zuerst: sechs Themen zum An- und Abwählen, darunter, wie viele neue Artikel dazu passen.',
        height: 280,
        render: (d, h) => {
          const load = h.state === 'loading', empty = h.state === 'empty';
          const m = h.state === 'error' ? MSG.error : !load && !d.topics.length ? MSG.empty : null;
          const topics = d.topics.map(t => ({ ...t, on: t.on && !empty }));
          const on = topics.filter(t => t.on).length, pointed = topics.findIndex(t => !t.on);
          const head = `
            <div class="re-head" data-area="text:kopf">
              <div class="stack">
                <p class="t-16 w-500">Deine Themen</p>
                <p class="t-14 ink-2">Danach wählen wir deine Artikel aus</p>
              </div>
              ${load ? bone('56px', 24) : m ? '' : `<span class="chip t-12 ink-2 num">${on} von ${topics.length}</span>`}
            </div>`;
          if (m) return `
          <div class="re-t is-msg">
            ${head}
            <div class="re-none" data-area="text:meldung">${note(h, m)}</div>
          </div>`;
          const bar = load ? `
              <div class="re-faces">${bone('32px', 32).repeat(3)}</div>
              <span class="grow">${sk(24, '96px')}</span>
              ${bone('32px', 32)}`
            : !on ? `
              <span class="re-ico">${h.icon('heart', 16)}</span>
              <p class="t-14 ink-2 grow clip">Wähle oben ein Thema</p>`
            : `
              <div class="re-faces">${d.articles.slice(0, 3).map((a, i) => h.media(i)).join('')}</div>
              <p class="t-14 w-500 grow">${d.fresh} neue Artikel</p>
              <button class="btn-round sm" aria-label="Artikel ansehen">${h.icon('arrow-right', 16)}</button>`;
          return `
          <div class="re-t">
            ${head}
            <div class="re-topics" data-area="control:themen">
              ${load ? bone('100%', 40).repeat(topics.length) : topics.map((t, i) => `
                <button class="toggle lg t-14${t.on ? ' is-on w-500' : ''}${h.state === 'hover' && i === pointed ? ' is-pointed' : ''}" aria-pressed="${t.on}">${h.icon(t.on ? 'check' : 'plus', 16)}${h.esc(t.name)}</button>`).join('')}
            </div>
            <div class="re-bar" data-area="control:ergebnis">${bar}
            </div>
          </div>`;
        },
      },
      {
        id: 'zeile',
        name: 'Zeile',
        family: 'listenzeile',
        idea: 'Ein Vorschlag als Zeile in einer Liste: Vorschaubild, Thema und Lesezeit über dem Titel, Merken rechts.',
        height: 96,
        render: (d, h) => {
          const m = msgOf(d, h), load = h.state === 'loading', a = d.articles[0];
          if (m) return `
          <div class="re-z is-msg">
            <div class="stack" data-area="text:artikel">
              <p class="t-14 tight w-500 clip">${m.title}</p>
              <p class="t-12 ink-2 clip">${m.short}</p>
            </div>
            <div class="re-acts" data-area="control:aktion" style="width:${m.w}px"><button class="btn-pill solid t-12 w-500">${m.action}</button></div>
          </div>`;
          return `
          <div class="re-z">
            ${load ? tile(h, null, 're-thumb', 'media:bild') : h.media(0, { class: 're-thumb', area: 'media:bild' })}
            <div class="stack" data-area="text:artikel">
              ${load ? sk(16, '40%') + sk(16, '100%') + sk(16, '56%') : `
              <p class="t-12 ink-2 clip">${kicker(a, h)}</p>
              <p class="t-14 tight w-500 re-two re-link">${h.esc(a.title)}</p>`}
            </div>
            <div data-area="control:merken">
              ${load ? bone('40px', 40) : `<button class="btn-round" aria-label="Merken">${h.icon('bookmark', 20)}</button>`}
            </div>
          </div>`;
        },
      },
      {
        id: 'teaser',
        name: 'Teaser',
        family: 'teaser',
        idea: 'Der Anreißer zuerst: randabfallendes Bild, darunter in Blau der Grund, dann Überschrift und Unterzeile.',
        height: 368,
        padding: 0,
        render: (d, h) => {
          const m = msgOf(d, h), load = h.state === 'loading', a = d.articles[0];
          if (m) return `
          <div class="re-tz">
            ${tile(h, m, 're-hero', 'media:bild', { size: 32, bleed: true })}
            <div class="re-msg">
              <div class="stack g-8" data-area="text:anreisser">
                <p class="t-12 ink-2 clip">${h.esc(d.title)}</p>
                <div class="stack">
                  <p class="t-20 w-500 clip" data-role="Überschrift">${m.title}</p>
                  <p class="t-14 ink-2 clip">${m.text}</p>
                </div>
              </div>
              ${act(h, m)}
            </div>
          </div>`;
          return `
          <div class="re-tz">
            ${load ? tile(h, null, 're-hero', 'media:bild', { bleed: true }) : h.media(0, { class: 're-hero', area: 'media:bild', bleed: true })}
            <div class="re-copy" data-area="text:anreisser">
              ${load ? `${sk(16, '48%')}<span class="stack">${sk(24, '100%')}${sk(24, '64%')}</span><span class="stack">${sk(24, '100%')}${sk(24, '80%')}</span>` : `
              <p class="t-12 ink-2 clip">${why(a, h)}</p>
              <p class="t-20 w-500 re-two re-link" data-role="Überschrift">${h.esc(a.title)}</p>
              <p class="t-14 ink-2 re-two">${h.esc(a.sub || '')}</p>`}
            </div>
          </div>`;
        },
      },
    ],
  });
})();
