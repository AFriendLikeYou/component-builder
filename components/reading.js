(() => {
  // Persönliche Leseliste: Vorschläge nach den gewählten Themen. Akzentfarbe nur für das Persönliche
  // (gewählte Themen, der Grund für einen Vorschlag, angefangene Artikel).
  const left = a => (a.left != null ? a.left : a.min);
  const kicker = (a, h) => a.left != null
    ? `<span class="re-acc w-500">Angefangen</span> · noch ${a.left} Min.`
    : `<span class="w-500">${h.esc(a.topic)}</span> · ${a.min} Min.`;

  Factory.register({
    id: 'reading',
    name: 'Leseliste',
    aliases: ['reading', 'leseliste', 'für dich', 'personalisierung', 'personalisierungswidget', 'empfehlungen', 'artikel', 'read later', 'später lesen'],
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
        { topic: 'Wissen', title: 'Warum die Nordsee schneller wärmer wird als gedacht', min: 8 },
        { topic: 'Digital', title: 'Wenn der Agent die Steuererklärung macht', min: 12, left: 5 },
        { topic: 'Politik', title: 'Die leise Macht der Bürgermeister', min: 6 },
        { topic: 'Wissen', title: 'Schlaf lässt sich nicht nachholen – oder doch?', min: 5 },
      ],
    },
    css: `
      .re-acc { color: var(--c-accent); }
      .re-two { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

      /* Aufmacher: randabfallendes Bild, darunter Titel und Grund */
      .re-a { display: grid; grid-template-rows: 192px 24px 72px 24px 40px; height: 100%; }
      .re-a .re-hero { grid-row: 1; }
      .re-a .re-text { grid-row: 3; margin: 0 24px; display: flex; flex-direction: column; gap: 8px; }
      .re-a .re-foot { grid-row: 5; margin: 0 24px; display: flex; gap: 16px; }
      .re-why { flex: 1; display: flex; align-items: center; }
      .re-why .chip { gap: 8px; background: var(--c-accent-soft); color: var(--c-accent); }

      /* Liste */
      .re-l { display: flex; flex-direction: column; gap: 16px; }
      .re-head { height: 32px; display: flex; align-items: center; justify-content: space-between; }
      .re-head .re-title { display: flex; align-items: baseline; gap: 8px; }
      .re-edit { width: 96px; padding: 0; justify-content: center; }
      .re-list { display: flex; flex-direction: column; gap: 16px; }
      .re-item { height: 48px; display: flex; align-items: center; gap: 16px; }
      .re-item .cf-media { width: 48px; height: 48px; border-radius: 8px; flex: none; }

      /* Themen */
      .re-t { display: flex; flex-direction: column; gap: 24px; }
      .re-t .re-head { height: 48px; align-items: flex-start; }
      .re-topics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .re-topic { height: 40px; border-radius: 999px; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--c-fill); color: var(--c-ink-2); }
      .re-topic.is-on { background: var(--c-accent-soft); color: var(--c-accent); }
      .re-bar { height: 48px; border-radius: 999px; background: var(--c-fill); display: flex; align-items: center; gap: 16px; padding: 0 8px; }
      .re-faces { display: flex; }
      .re-faces .cf-media { width: 32px; height: 32px; border-radius: 999px; flex: none; box-shadow: 0 0 0 2px var(--c-fill); }
      .re-faces .cf-media + .cf-media { margin-left: -8px; }
      .re-bar .btn-round { background: var(--c-surface); }
    `,
    layouts: [
      {
        id: 'aufmacher',
        name: 'Aufmacher',
        idea: 'Der beste Vorschlag zuerst: großes Bild, Titel, und darunter in Blau, warum er für dich ausgewählt wurde.',
        height: 376,
        padding: 0,
        render: (d, h) => {
          const a = d.articles[0];
          return `
          <div class="re-a">
            ${h.media(0, { class: 're-hero', area: 'media:bild', bleed: true })}
            <div class="re-text" data-area="text:artikel">
              <p class="t-12 ink-2">${kicker(a, h)}</p>
              <p class="t-20 w-500 re-two" data-role="Titel">${h.esc(a.title)}</p>
            </div>
            <div class="re-foot">
              <div class="re-why" data-area="meta:grund">
                <span class="chip t-12">${h.icon('heart', 16)}Weil du ${h.esc(a.topic)} folgst</span>
              </div>
              <div class="row g-8" data-area="control:aktionen">
                <button class="btn-round" aria-label="Merken">${h.icon('bookmark', 20)}</button>
                <button class="btn-round solid" aria-label="Lesen">${h.icon('arrow-right', 20)}</button>
              </div>
            </div>
          </div>`;
        },
      },
      {
        id: 'liste',
        name: 'Liste',
        idea: 'Was als Nächstes zu lesen ist: vier Artikel mit Thema und Lesezeit, ein angefangener ist blau markiert.',
        height: 336,
        render: (d, h) => `
          <div class="re-l">
            <div class="re-head" data-area="text:kopf">
              <p class="re-title"><span class="t-16 w-500">${h.esc(d.title)}</span><span class="t-12 ink-2 num">${d.articles.length} Artikel · ${d.articles.reduce((s, a) => s + left(a), 0)} Min.</span></p>
              <button class="btn-pill re-edit t-12 ink-2" data-area="control:themen">${h.icon('edit', 16)}<span>Themen</span></button>
            </div>
            <div class="re-list" data-area="text:liste">
              ${d.articles.map((a, i) => `
                <div class="re-item" data-area="text:artikel-${i + 1}">
                  ${h.media(i)}
                  <div class="stack grow">
                    <p class="t-12 ink-2 clip">${kicker(a, h)}</p>
                    <p class="t-14 tight w-500 re-two">${h.esc(a.title)}</p>
                  </div>
                </div>`).join('')}
            </div>
          </div>`,
      },
      {
        id: 'themen',
        name: 'Themen',
        idea: 'Personalisieren zuerst: sechs Themen zum An- und Abwählen, darunter, wie viele neue Artikel dazu passen.',
        height: 280,
        render: (d, h) => `
          <div class="re-t">
            <div class="re-head" data-area="text:kopf">
              <div class="stack">
                <p class="t-16 w-500">Deine Themen</p>
                <p class="t-14 ink-2">Danach wählen wir deine Artikel aus</p>
              </div>
              <span class="chip t-12 ink-2 num">${d.topics.filter(t => t.on).length} von ${d.topics.length}</span>
            </div>
            <div class="re-topics" data-area="control:themen">
              ${d.topics.map(t => `
                <button class="re-topic t-14${t.on ? ' is-on w-500' : ''}" aria-pressed="${t.on}">${h.icon(t.on ? 'check' : 'plus', 16)}${h.esc(t.name)}</button>`).join('')}
            </div>
            <div class="re-bar" data-area="control:ergebnis">
              <div class="re-faces">${d.articles.slice(0, 3).map((a, i) => h.media(i)).join('')}</div>
              <p class="t-14 w-500 grow">${d.fresh} neue Artikel</p>
              <button class="btn-round sm" aria-label="Artikel ansehen">${h.icon('arrow-right', 16)}</button>
            </div>
          </div>`,
      },
    ],
  });
})();
