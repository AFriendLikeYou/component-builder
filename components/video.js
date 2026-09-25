(() => {
  // Ein Videoplayer in drei Größen: Video mit Abspielknopf (32, 48, 64), Titel und Spielzeit.
  // Der Knopf liegt immer mittig auf dem Video, der Fortschritt ist in allen Größen blau.
  const video = (h, d, icon, { bleed, line = true } = {}) => `
    <div class="vi-video"${bleed ? ' data-bleed' : ''} data-area="media:video">
      ${h.media(0)}
      <button class="vi-play" aria-label="Abspielen">${h.icon('play', icon)}</button>
      ${line ? `<div class="vi-line"><span style="width:${d.progress * 100}%"></span></div>` : ''}
    </div>`;
  const playtime = d => `<span class="num">${d.elapsed} / ${d.duration}</span>`;

  Factory.register({
    id: 'video',
    name: 'Video',
    aliases: ['video', 'videoplayer', 'player', 'film', 'clip', 'videokarte'],
    data: {
      title: 'Wie Wale in der Tiefe singen',
      channel: 'Wissen',
      date: 'vor 2 Tagen',
      elapsed: '4:12',
      duration: '12:30',
      progress: 0.34,
    },
    css: `
      .vi-video { position: relative; display: grid; place-items: center; overflow: hidden; }
      .vi-video > .cf-media { position: absolute; inset: 0; }
      .vi-play { position: relative; width: 48px; height: 48px; border-radius: 999px; display: grid; place-items: center; background: var(--c-surface); color: var(--c-ink); box-shadow: 0 8px 24px -8px rgba(0, 0, 0, .4); transition: box-shadow .15s; }
      .vi-line { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: color-mix(in srgb, var(--c-surface) 48%, transparent); }
      .vi-line > span { display: block; height: 100%; background: var(--c-accent); }
      .vi-two { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

      /* Klein: Vorschaubild links, Titel und Spielzeit daneben */
      .vi-k { display: grid; grid-template-columns: 128px minmax(0, 1fr); gap: 16px; height: 72px; }
      .vi-k .vi-video { border-radius: 8px; }
      .vi-k .vi-play { width: 32px; height: 32px; }
      .vi-k .vi-text { display: flex; flex-direction: column; justify-content: center; gap: 8px; min-width: 0; }

      /* Mittel: Video über die Kartenbreite, darunter Titel und Spielzeit */
      .vi-m { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 168px 48px; gap: 16px; }
      .vi-m .vi-video { border-radius: 16px; }

      /* Groß: randabfallendes Video, Titel und Fortschritt mit Spielzeit */
      .vi-g { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 240px 24px 48px 16px 32px; height: 100%; }
      .vi-g .vi-video { grid-row: 1; }
      .vi-g .vi-play { width: 64px; height: 64px; }
      .vi-g .vi-title { grid-row: 3; margin: 0 24px; }
      .vi-g .vi-prog { grid-row: 5; margin: 0 24px; display: flex; flex-direction: column; gap: 8px; }
      .vi-bar { height: 8px; display: flex; align-items: center; }
      .vi-track { flex: 1; height: 4px; border-radius: 999px; background: var(--c-fill-2); overflow: hidden; transition: height .15s; }
      .vi-fill { height: 100%; border-radius: 999px; background: var(--c-accent); }

      /* Hover: der Abspielknopf bekommt einen hellen Ring, der Balken wird dicker */
      &:is(:hover, .is-hover) .vi-play { box-shadow: 0 0 0 8px color-mix(in srgb, var(--c-surface) 32%, transparent), 0 8px 24px -8px rgba(0, 0, 0, .4); }
      &:is(:hover, .is-hover) .vi-track { height: 8px; }
    `,
    layouts: [
      {
        id: 'klein',
        name: 'Klein',
        family: 'listenzeile',
        idea: 'Der Titel zuerst: kleines Vorschaubild mit Abspielknopf, daneben Titel und Spielzeit – passt in jede Liste.',
        height: 120,
        render: (d, h) => `
          <div class="vi-k">
            ${video(h, d, 16)}
            <div class="vi-text" data-area="text:titel">
              <p class="t-14 tight w-500 vi-two">${h.esc(d.title)}</p>
              <p class="t-12 ink-2 clip">${h.esc(d.channel)} · ${playtime(d)}</p>
            </div>
          </div>`,
      },
      {
        id: 'mittel',
        name: 'Mittel',
        family: 'karte',
        idea: 'Das Bild zuerst: Video über die ganze Kartenbreite mit großem Abspielknopf, darunter Titel und Spielzeit.',
        height: 280,
        render: (d, h) => `
          <div class="vi-m">
            ${video(h, d, 20)}
            <div class="stack" data-area="text:titel">
              <p class="t-16 w-500 clip">${h.esc(d.title)}</p>
              <p class="t-14 ink-2 clip">${h.esc(d.channel)} · ${playtime(d)}</p>
            </div>
          </div>`,
      },
      {
        id: 'gross',
        name: 'Groß',
        family: 'karte',
        idea: 'Die Wiedergabe zuerst: randabfallendes Video mit dem größten Abspielknopf, darunter der Fortschritt mit Spielzeit über die ganze Breite.',
        width: 432,
        height: 384,
        padding: 0,
        render: (d, h) => `
          <div class="vi-g">
            ${video(h, d, 28, { bleed: true, line: false })}
            <div class="vi-title stack" data-area="text:titel">
              <p class="t-20 w-500 clip">${h.esc(d.title)}</p>
              <p class="t-14 ink-2 clip">${h.esc(d.channel)} · ${h.esc(d.date)}</p>
            </div>
            <div class="vi-prog" data-area="meta:spielzeit">
              <div class="vi-bar"><div class="vi-track"><div class="vi-fill" style="width:${d.progress * 100}%"></div></div></div>
              <div class="row between t-12 ink-2 num"><span>${d.elapsed}</span><span>${d.duration}</span></div>
            </div>
          </div>`,
      },
    ],
  });
})();
