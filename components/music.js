(() => {
  // Zustände (h.state): „loading“ = Skelett in denselben Flächen und Maßen, „empty“ und „error“ = Meldung mit genau einer Handlung.
  // Hover hebt hervor, was man bedienen kann; die Stile hängen an .is-hover (Vorschau) und :hover.
  // teaser = [Dachzeile, Überschrift] im Teaser; w = feste Breite der Handlung in der Listenzeile (dort ohne Icon, damit der Text daneben Platz hat)
  const MSG = {
    empty: { icon: 'volume', title: 'Gerade läuft nichts', text: 'Lust auf einen Mix?', teaser: ['Gerade läuft nichts', 'Lust auf einen Mix?'], action: 'Mix starten', actIcon: 'shuffle', w: 112 },
    error: { icon: 'close', title: 'Keine Verbindung', text: 'Wiedergabe gestoppt', teaser: ['Wiedergabe gestoppt', 'Keine Verbindung'], action: 'Erneut versuchen', actIcon: 'refresh', w: 152, error: true },
  };
  const MAX = 4; // Titel in der Warteschlange
  const sk = (lh, w) => `<span class="mu-sk" style="height:${lh}px;--w:${w}"></span>`;
  const tile = (h, m, cls, area, { size = 24, bleed } = {}) =>
    `<div class="${cls} mu-tile${m && m.error ? ' is-error' : ''}"${bleed ? ' data-bleed' : ''}${area ? ` data-area="${area}"` : ''}>${m ? h.icon(m.icon, size) : ''}</div>`;
  const act = (h, m, narrow) => `<div class="mu-acts" data-area="control:aktion"${narrow ? ` style="width:${m.w}px"` : ''}><button class="btn-pill lg solid w-500${narrow ? ' t-14' : ''} mu-act">${narrow ? '' : h.icon(m.actIcon, 16)}${m.action}</button></div>`;
  const track = p => `<div class="progress mu-track" style="--p: ${p == null ? 0 : p}"><i></i></div>`;

  Factory.register({
    id: 'music',
    name: 'Musik',
    aliases: ['music', 'player', 'song', 'musikkarte'],
    states: ['hover', 'loading', 'empty', 'error'],
    data: {
      title: 'Nachtfahrt',
      artist: 'Mira Lenz',
      kicker: 'Neu im Mix',
      blurb: 'Ein Lied für die Heimfahrt: warme Synthesizer, Regen und eine leere Autobahn.',
      elapsed: '1:47',
      remaining: '−2:23',
      progress: 0.43,
      queue: [
        { title: 'Nachtfahrt', artist: 'Mira Lenz', dur: '4:10' },
        { title: 'Leise Stadt', artist: 'Holm', dur: '3:32' },
        { title: 'Kupfer', artist: 'Die Wellen', dur: '5:04' },
        { title: 'Morgengrau', artist: 'Ada Voss', dur: '2:58' },
      ],
    },
    css: `
      .mu-bar { height: 8px; display: flex; align-items: center; }
      .mu-track { flex: 1; }
      .mu-track > i { transition: background-color .15s; }
      .btn-round.ghost { transition: background-color .15s; }
      .btn-round.solid, .mu-act { transition: box-shadow .15s; }

      .mu-c { display: grid; grid-template-columns: 88px minmax(0, 1fr); grid-template-rows: 48px 40px 24px 40px; column-gap: 16px; height: 100%; }
      .mu-c .mu-cover { grid-row: 1 / span 2; border-radius: 8px; }
      .mu-c .mu-ctl { grid-column: 2; grid-row: 2; }
      .mu-c .mu-prog { grid-column: 1 / -1; grid-row: 4; display: flex; flex-direction: column; gap: 16px; }
      .mu-c .mu-acts { grid-column: 1 / -1; grid-row: 4; }

      .mu-a { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 288px 24px 48px 16px 8px; height: 100%; }
      .mu-a .mu-hero { grid-row: 1; }
      .mu-a .mu-row { grid-row: 3; display: flex; gap: 16px; padding: 0 24px; }
      .mu-a .mu-bar { grid-row: 5; margin: 0 24px; }
      .mu-a .mu-dot { width: 48px; height: 48px; }
      .mu-a .mu-acts { grid-row: 2 / span 4; margin: 0 24px; display: flex; align-items: center; }
      .mu-note { width: calc(100% - 48px); display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }

      .mu-q { display: flex; flex-direction: column; gap: 16px; }
      .mu-list { display: flex; flex-direction: column; gap: 8px; }
      .mu-item { position: relative; height: 48px; display: flex; align-items: center; gap: 16px; }
      .mu-item :is(.cf-media, .mu-tile) { width: 48px; height: 48px; border-radius: 8px; flex: none; }
      .mu-item.is-now .mu-name { color: var(--c-accent); }
      .mu-more { height: 48px; }
      .mu-ov { position: absolute; left: 0; top: 0; width: 48px; height: 48px; border-radius: 8px; display: none; place-items: center; background: color-mix(in srgb, var(--c-ink) 48%, transparent); color: var(--c-surface); }
      .mu-none { height: 216px; align-items: center; justify-content: center; gap: 16px; text-align: center; }
      .mu-none .mu-badge { width: 48px; height: 48px; border-radius: 999px; }
      .mu-none .mu-acts { align-self: stretch; display: flex; justify-content: center; }

      /* Listenzeile: Cover, Titel mit Fortschritt, Abspielen */
      .mu-z { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 16px; align-items: center; height: 48px; }
      .mu-z .mu-cover { width: 48px; height: 48px; border-radius: 8px; }
      .mu-z .mu-mid { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .mu-z .mu-dot { width: 48px; height: 48px; }
      .mu-z.is-msg { grid-template-columns: minmax(0, 1fr) auto; }
      .mu-z .mu-acts { height: 48px; display: flex; align-items: center; }

      /* Teaser: randabfallendes Bild, Dachzeile, Überschrift, Unterzeile */
      .mu-t { display: grid; grid-template-rows: 176px 24px 112px; height: 100%; }
      .mu-t .mu-img { grid-row: 1; }
      .mu-t .mu-copy { grid-row: 3; margin: 0 24px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .mu-t .mu-sub { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .mu-t .mu-msg { grid-row: 3; margin: 0 24px; display: flex; flex-direction: column; gap: 16px; }
      .mu-head { text-decoration-thickness: 2px; text-underline-offset: 4px; }

      /* Zustände: Skelett, Kacheln statt Bild, eine Handlung */
      .mu-sk { display: flex; align-items: center; }
      .mu-sk::before { content: ''; width: var(--w, 100%); height: 8px; border-radius: 999px; background: var(--c-fill); }
      .mu-dot { display: block; flex: none; width: 40px; height: 40px; border-radius: 999px; background: var(--c-fill); }
      .mu-tile { display: grid; place-items: center; background: var(--c-fill); }
      .mu-tile.is-error { background: var(--c-warm-soft); }
      .mu-tile .icon { color: var(--c-ink-3); }
      .mu-tile.is-error .icon { color: var(--c-warm); }
      .mu-act { width: 100%; justify-content: center; white-space: nowrap; }
      :is(.mu-t, .mu-none) .mu-act { width: auto; }

      /* Hover: Bedienbares tritt hervor */
      &:is(:hover, .is-hover) .btn-round.ghost { background: var(--c-fill); }
      &:is(:hover, .is-hover) :is(.btn-round.solid, .mu-act) { box-shadow: 0 0 0 4px var(--c-fill-2); }
      &:is(:hover, .is-hover) .mu-track > i { background: var(--c-accent); }
      &:is(:hover, .is-hover) .mu-head { text-decoration-line: underline; }
      .mu-item:hover .mu-ov, &.is-hover .mu-item:nth-child(2) .mu-ov { display: grid; }
    `,
    layouts: [
      {
        id: 'kompakt',
        name: 'Kompakt',
        family: 'karte',
        idea: 'Steuerung zuerst: Cover und Titel teilen sich eine Zeile, der Fortschritt läuft über die ganze Breite.',
        height: 200,
        render: (d, h) => {
          const m = MSG[h.state], load = h.state === 'loading';
          if (m) return `
            <div class="mu-c">
              ${tile(h, m, 'mu-cover', 'media:cover', { size: 32 })}
              <div class="stack" data-area="text:titel">
                <p class="t-16 w-500 clip">${m.title}</p>
                <p class="t-14 ink-2 clip">${m.text}</p>
              </div>
              ${act(h, m)}
            </div>`;
          return `
            <div class="mu-c">
              ${load ? tile(h, null, 'mu-cover', 'media:cover') : h.media(0, { class: 'mu-cover', area: 'media:cover' })}
              <div class="stack" data-area="text:titel">
                ${load ? sk(24, '64%') + sk(24, '40%') : `
                <p class="t-16 w-500 clip">${h.esc(d.title)}</p>
                <p class="t-14 ink-2 clip">${h.esc(d.artist)}</p>`}
              </div>
              <div class="mu-ctl row g-8" data-area="control:steuerung">
                ${load ? '<span class="mu-dot"></span>'.repeat(3) : `
                <button class="btn-round ghost" aria-label="Zurück">${h.icon('prev', 20)}</button>
                <button class="btn-round solid" aria-label="Pause">${h.icon('pause', 18)}</button>
                <button class="btn-round ghost" aria-label="Weiter">${h.icon('next', 20)}</button>`}
              </div>
              <div class="mu-prog" data-area="meta:fortschritt">
                <div class="mu-bar">${track(load ? null : d.progress)}</div>
                ${load ? `<div class="row between">${sk(16, '32px')}${sk(16, '32px')}</div>`
                  : `<div class="row between t-12 ink-2 num"><span>${d.elapsed}</span><span>${d.remaining}</span></div>`}
              </div>
            </div>`;
        },
      },
      {
        id: 'cover',
        name: 'Cover',
        family: 'karte',
        idea: 'Das Bild zuerst: randabfallendes Cover, darunter nur Titel, Abspielen und Fortschritt.',
        height: 408,
        padding: 0,
        render: (d, h) => {
          const m = MSG[h.state], load = h.state === 'loading';
          if (m) return `
            <div class="mu-a">
              <div class="mu-hero mu-tile${m.error ? ' is-error' : ''}" data-bleed data-area="media:cover">
                <div class="mu-note" data-area="text:meldung">
                  ${h.icon(m.icon, 32)}
                  <div class="stack">
                    <p class="t-16 w-500">${m.title}</p>
                    <p class="t-14 ink-2">${m.text}</p>
                  </div>
                </div>
              </div>
              ${act(h, m)}
            </div>`;
          return `
            <div class="mu-a">
              ${load ? tile(h, null, 'mu-hero', 'media:cover', { bleed: true }) : h.media(0, { class: 'mu-hero', area: 'media:cover', bleed: true })}
              <div class="mu-row">
                <div class="stack grow" data-area="text:titel">
                  ${load ? sk(24, '56%') + sk(24, '32%') : `
                  <p class="t-16 w-500 clip">${h.esc(d.title)}</p>
                  <p class="t-14 ink-2 clip">${h.esc(d.artist)}</p>`}
                </div>
                <div data-area="control:abspielen">
                  ${load ? '<span class="mu-dot"></span>' : `<button class="btn-round lg solid" aria-label="Pause">${h.icon('pause', 20)}</button>`}
                </div>
              </div>
              <div class="mu-bar" data-area="meta:fortschritt">${track(load ? null : d.progress)}</div>
            </div>`;
        },
      },
      {
        id: 'warteschlange',
        name: 'Warteschlange',
        family: 'karte',
        idea: 'Was kommt als Nächstes: die Liste führt, das laufende Stück ist nur farblich markiert.',
        height: 304,
        render: (d, h) => {
          const load = h.state === 'loading';
          const m = MSG[h.state] || (!load && !d.queue.length ? MSG.empty : null);
          // mehr als MAX Titel: drei zeigen, dazu „3 von 12 Titeln · Alle anzeigen“ in derselben Höhe
          const shown = d.queue.length > MAX ? d.queue.slice(0, MAX - 1) : d.queue;
          const count = load ? sk(16, '48px') : m && m.error ? '' : `<p class="t-12 ink-2">${m ? 0 : d.queue.length} Titel</p>`;
          const list = m ? `
            <div class="mu-list mu-none" data-area="text:liste">
              ${tile(h, m, 'mu-badge')}
              <div class="stack">
                <p class="t-16 w-500">${m.error ? m.title : 'Nichts in der Warteschlange'}</p>
                <p class="t-14 ink-2">${m.text}</p>
              </div>
              ${act(h, m)}
            </div>`
            : load ? `
            <div class="mu-list" data-area="text:liste">
              ${['64%', '48%', '56%', '40%'].map((w, i) => `
                <div class="mu-item" data-area="text:titel-${i + 1}">
                  ${tile(h, null, 'mu-thumb')}
                  <div class="stack grow">${sk(16, w)}${sk(16, '32%')}</div>
                  ${sk(16, '32px')}
                </div>`).join('')}
            </div>`
            : `
            <div class="mu-list" data-area="text:liste">
              ${shown.map((q, i) => `
                <div class="mu-item${i === 0 ? ' is-now' : ''}" data-area="text:titel-${i + 1}">
                  ${h.media(i)}
                  <span class="mu-ov">${h.icon(i === 0 ? 'pause' : 'play', 16)}</span>
                  <div class="stack grow">
                    <p class="t-14 tight w-500 clip mu-name">${h.esc(q.title)}</p>
                    <p class="t-12 ink-2 clip">${h.esc(q.artist)}</p>
                  </div>
                  <p class="t-12 ink-2 num">${i === 0 ? d.elapsed : q.dur}</p>
                </div>`).join('')}
              ${shown.length < d.queue.length ? `
              <div class="row between mu-more" data-area="control:alle">
                <p class="t-12 ink-2">${shown.length} von ${d.queue.length} Titeln</p>
                <button class="btn-text t-14 w-500">Alle anzeigen</button>
              </div>` : ''}
            </div>`;
          return `
            <div class="mu-q">
              <div class="row between" data-area="text:kopf">
                <p class="t-16 w-500">Warteschlange</p>
                ${count}
              </div>
              ${list}
            </div>`;
        },
      },
      {
        id: 'zeile',
        name: 'Zeile',
        family: 'listenzeile',
        idea: 'Eine Zeile in einer Liste: Cover, Titel und Restzeit mit dem Fortschritt darunter, Abspielen rechts.',
        height: 96,
        render: (d, h) => {
          const m = MSG[h.state], load = h.state === 'loading';
          if (m) return `
            <div class="mu-z is-msg">
              <div class="stack" data-area="text:titel">
                <p class="t-14 tight w-500 clip">${m.title}</p>
                <p class="t-12 ink-2 clip">${m.text}</p>
              </div>
              ${act(h, m, true)}
            </div>`;
          return `
            <div class="mu-z">
              ${load ? tile(h, null, 'mu-cover', 'media:cover') : h.media(0, { class: 'mu-cover', area: 'media:cover' })}
              <div class="mu-mid">
                <div class="stack" data-area="text:titel">
                  ${load ? sk(16, '56%') + sk(16, '40%') : `
                  <p class="t-14 tight w-500 clip">${h.esc(d.title)}</p>
                  <div class="row between g-8 t-12 ink-2"><span class="clip">${h.esc(d.artist)}</span><span class="num">${d.remaining}</span></div>`}
                </div>
                <div class="mu-bar" data-area="meta:fortschritt">${track(load ? null : d.progress)}</div>
              </div>
              <div data-area="control:abspielen">
                ${load ? '<span class="mu-dot"></span>' : `<button class="btn-round lg solid" aria-label="Pause">${h.icon('pause', 20)}</button>`}
              </div>
            </div>`;
        },
      },
      {
        id: 'teaser',
        name: 'Teaser',
        family: 'teaser',
        idea: 'Der Anreißer zuerst: randabfallendes Cover, darunter Überschrift und eine Zeile, warum man reinhören sollte.',
        height: 336,
        padding: 0,
        render: (d, h) => {
          const m = MSG[h.state], load = h.state === 'loading';
          if (m) return `
            <div class="mu-t">
              ${tile(h, m, 'mu-img', 'media:bild', { size: 32, bleed: true })}
              <div class="mu-msg">
                <div class="stack g-8" data-area="text:anreisser">
                  <p class="t-12 ink-2 clip">${m.teaser[0]}</p>
                  <p class="t-24 w-500 clip mu-head" data-role="Überschrift">${m.teaser[1]}</p>
                </div>
                ${act(h, m)}
              </div>
            </div>`;
          return `
            <div class="mu-t">
              ${load ? tile(h, null, 'mu-img', 'media:bild', { bleed: true }) : h.media(0, { class: 'mu-img', area: 'media:bild', bleed: true })}
              <div class="mu-copy" data-area="text:anreisser">
                ${load ? `${sk(16, '40%')}${sk(32, '64%')}<span class="stack">${sk(24, '100%')}${sk(24, '72%')}</span>` : `
                <p class="t-12 ink-2 clip"><span class="w-500">${h.esc(d.kicker)}</span> · ${h.esc(d.artist)}</p>
                <p class="t-24 w-500 clip mu-head" data-role="Überschrift">${h.esc(d.title)}</p>
                <p class="t-14 ink-2 mu-sub">${h.esc(d.blurb)}</p>`}
              </div>
            </div>`;
        },
      },
    ],
  });
})();
