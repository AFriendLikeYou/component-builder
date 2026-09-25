Factory.register({
  id: 'music',
  name: 'Musik',
  aliases: ['music', 'player', 'song', 'musikkarte'],
  data: {
    title: 'Nachtfahrt',
    artist: 'Mira Lenz',
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
    .mu-track { flex: 1; height: 4px; border-radius: 999px; background: var(--c-fill-2); overflow: hidden; }
    .mu-fill { height: 100%; border-radius: 999px; background: var(--c-ink); }

    .mu-c { display: grid; grid-template-columns: 88px 1fr; grid-template-rows: 48px 40px 24px 40px; column-gap: 16px; height: 100%; }
    .mu-c .mu-cover { grid-row: 1 / span 2; border-radius: 8px; }
    .mu-c .mu-ctl { grid-column: 2; grid-row: 2; }
    .mu-c .mu-prog { grid-column: 1 / -1; grid-row: 4; display: flex; flex-direction: column; gap: 16px; }

    .mu-a { display: grid; grid-template-rows: 288px 24px 48px 16px 8px; height: 100%; }
    .mu-a .mu-hero { grid-row: 1; }
    .mu-a .mu-row { grid-row: 3; display: flex; gap: 16px; padding: 0 24px; }
    .mu-a .mu-bar { grid-row: 5; margin: 0 24px; }
    .mu-a .btn-round { width: 48px; height: 48px; }

    .mu-q { display: flex; flex-direction: column; gap: 16px; }
    .mu-list { display: flex; flex-direction: column; gap: 8px; }
    .mu-item { height: 48px; display: flex; align-items: center; gap: 16px; }
    .mu-item .cf-media { width: 48px; height: 48px; border-radius: 8px; flex: none; }
    .mu-item.is-now .mu-name { color: var(--c-accent); }
  `,
  layouts: [
    {
      id: 'kompakt',
      name: 'Kompakt',
      idea: 'Steuerung zuerst: Cover und Titel teilen sich eine Zeile, der Fortschritt läuft über die ganze Breite.',
      height: 200,
      render: (d, h) => `
        <div class="mu-c">
          ${h.media(0, { class: 'mu-cover', area: 'media:cover' })}
          <div class="stack" data-area="text:titel">
            <p class="t-16 w-500 clip">${h.esc(d.title)}</p>
            <p class="t-14 ink-2 clip">${h.esc(d.artist)}</p>
          </div>
          <div class="mu-ctl row g-8" data-area="control:steuerung">
            <button class="btn-round" style="background:none" aria-label="Zurück">${h.icon('prev', 20)}</button>
            <button class="btn-round solid" aria-label="Pause">${h.icon('pause', 18)}</button>
            <button class="btn-round" style="background:none" aria-label="Weiter">${h.icon('next', 20)}</button>
          </div>
          <div class="mu-prog" data-area="meta:fortschritt">
            <div class="mu-bar"><div class="mu-track"><div class="mu-fill" style="width:${d.progress * 100}%"></div></div></div>
            <div class="row between t-12 ink-2 num"><span>${d.elapsed}</span><span>${d.remaining}</span></div>
          </div>
        </div>`,
    },
    {
      id: 'cover',
      name: 'Cover',
      idea: 'Das Bild zuerst: randabfallendes Cover, darunter nur Titel, Abspielen und Fortschritt.',
      height: 408,
      padding: 0,
      render: (d, h) => `
        <div class="mu-a">
          ${h.media(0, { class: 'mu-hero', area: 'media:cover', bleed: true })}
          <div class="mu-row">
            <div class="stack grow" data-area="text:titel">
              <p class="t-16 w-500 clip">${h.esc(d.title)}</p>
              <p class="t-14 ink-2 clip">${h.esc(d.artist)}</p>
            </div>
            <div data-area="control:abspielen">
              <button class="btn-round solid" aria-label="Pause">${h.icon('pause', 20)}</button>
            </div>
          </div>
          <div class="mu-bar" data-area="meta:fortschritt"><div class="mu-track"><div class="mu-fill" style="width:${d.progress * 100}%"></div></div></div>
        </div>`,
    },
    {
      id: 'warteschlange',
      name: 'Warteschlange',
      idea: 'Was kommt als Nächstes: die Liste führt, das laufende Stück ist nur farblich markiert.',
      height: 304,
      render: (d, h) => `
        <div class="mu-q">
          <div class="row between" data-area="text:kopf">
            <p class="t-16 w-500">Warteschlange</p>
            <p class="t-12 ink-2">${d.queue.length} Titel</p>
          </div>
          <div class="mu-list" data-area="text:liste">
            ${d.queue.map((q, i) => `
              <div class="mu-item${i === 0 ? ' is-now' : ''}" data-area="text:titel-${i + 1}">
                ${h.media(i)}
                <div class="stack grow">
                  <p class="t-14 tight w-500 clip mu-name">${h.esc(q.title)}</p>
                  <p class="t-12 ink-2 clip">${h.esc(q.artist)}</p>
                </div>
                <p class="t-12 ink-2 num">${i === 0 ? d.elapsed : q.dur}</p>
              </div>`).join('')}
          </div>
        </div>`,
    },
  ],
});
