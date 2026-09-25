(() => {
  // Ein Videoplayer in drei Größen: Video mit Abspielknopf (32, 48, 64), Titel und Spielzeit.
  // Der Knopf liegt immer mittig auf dem Video, der Fortschritt ist in allen Größen blau.
  // size = Variante des runden Knopfs: sm 32, lg 48, xl 64
  const video = (h, d, size, icon, { bleed, line = true } = {}) => `
    <div class="vi-video"${bleed ? ' data-bleed' : ''} data-area="media:video">
      ${h.media(0)}
      <button class="btn-round float ${size} vi-play" aria-label="Abspielen">${h.icon('play', icon)}</button>
      ${line ? `<div class="progress on-media accent vi-line" style="--p: ${d.progress}"><i></i></div>` : ''}
    </div>`;
  const track = d => `<div class="vi-bar"><div class="progress accent vi-track" style="--p: ${d.progress}"><i></i></div></div>`;
  const playtime = d => `<span class="num">${d.elapsed} / ${d.duration}</span>`;
  const zds = h => h.S.id === 'zds' ? ' is-zds' : '';

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
      .vi-play { position: relative; transition: box-shadow .15s; }
      .vi-line { position: absolute; left: 0; right: 0; bottom: 0; }
      .vi-line.accent > i { background: var(--c-accent); }
      .vi-two { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

      /* Klein: Vorschaubild links, Titel und Spielzeit daneben */
      .vi-k { display: grid; grid-template-columns: 128px minmax(0, 1fr); gap: 16px; height: 72px; }
      .vi-k .vi-video { border-radius: var(--r-8); }
      .vi-k .vi-text { display: flex; flex-direction: column; justify-content: center; gap: 8px; min-width: 0; }

      /* Mittel: Video über die Kartenbreite, darunter Titel und Spielzeit */
      .vi-m { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 168px 48px; gap: 16px; }
      .vi-m .vi-video { border-radius: var(--r-16); }
      .vi-m.is-zds .vi-video { border-radius: var(--r-8); }

      /* Groß: randabfallendes Video, Titel und Fortschritt mit Spielzeit */
      .vi-g { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 240px 24px 48px 16px 32px; height: 100%; }
      .vi-g .vi-video { grid-row: 1; }
      .vi-g .vi-title { grid-row: 3; margin: 0 24px; }
      .vi-g .vi-prog { grid-row: 5; margin: 0 24px; display: flex; flex-direction: column; gap: 8px; }
      .vi-bar { height: 8px; display: flex; align-items: center; }
      .vi-track { flex: 1; }

      /* Vollbild: das Video füllt die Karte, Titel oben und Steuerung unten liegen auf Verläufen –
         in der Fabrik dunkel, im ZDS hell und gedeckt aus der Kartenfläche */
      .vi-f { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 24px 40px 1fr 48px 24px; height: 100%; }
      .vi-f .vi-video { grid-area: 1 / 1 / -1 / -1; }
      .vi-f .vi-video::after { content: ''; position: absolute; inset: 0; --vi-veil: var(--c-surface); background: linear-gradient(to bottom, color-mix(in srgb, var(--vi-veil) 88%, transparent), color-mix(in srgb, var(--vi-veil) 48%, transparent) 24%, transparent 48%, transparent 52%, color-mix(in srgb, var(--vi-veil) 56%, transparent) 72%, color-mix(in srgb, var(--vi-veil) 88%, transparent)); }
      &.is-dark .vi-f .vi-video::after { --vi-veil: var(--c-dark); }
      .vi-f .vi-play { z-index: 1; }
      .vi-f .vi-title { grid-area: 2 / 1; position: relative; margin: 0 24px; }
      .vi-f .vi-ctl { grid-area: 4 / 1; position: relative; margin: 0 24px; display: flex; flex-direction: column; gap: 8px; }
      &.is-dark .vi-f .vi-track { background: color-mix(in srgb, var(--c-on-dark) 32%, transparent); }
      &.is-dark .vi-f .vi-track > i { background: var(--c-accent); }
      .vi-btn { transition: background-color .15s; }
      .vi-btn:hover { background: var(--c-fill); }
      &.is-dark .vi-btn:hover { background: color-mix(in srgb, var(--c-on-dark) 16%, transparent); }

      /* Hover: der Abspielknopf bekommt einen hellen Ring */
      &:is(:hover, .is-hover) .vi-play { box-shadow: 0 0 0 8px color-mix(in srgb, var(--c-surface) 32%, transparent), 0 8px 24px -8px rgba(0, 0, 0, .4); }
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
            ${video(h, d, 'sm', 16)}
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
          <div class="vi-m${zds(h)}">
            ${video(h, d, 'lg', 20)}
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
            ${video(h, d, 'xl', 28, { bleed: true, line: false })}
            <div class="vi-title stack" data-area="text:titel">
              <p class="t-20 w-500 clip">${h.esc(d.title)}</p>
              <p class="t-14 ink-2 clip">${h.esc(d.channel)} · ${h.esc(d.date)}</p>
            </div>
            <div class="vi-prog" data-area="meta:spielzeit">
              ${track(d)}
              <div class="row between t-12 ink-2 num"><span>${d.elapsed}</span><span>${d.duration}</span></div>
            </div>
          </div>`,
      },
      {
        id: 'vollbild',
        name: 'Vollbild',
        family: 'karte',
        idea: 'Nur das Video: es füllt die ganze Karte im 16:9-Format, Titel und Steuerung liegen auf Verläufen darüber wie im Vollbild.',
        width: 432,
        height: 240,
        padding: 0,
        dark: S => S.id !== 'zds', // im ZDS hell: Verläufe aus der Kartenfläche statt dunkler Bühne
        render: (d, h) => `
          <div class="vi-f">
            ${video(h, d, 'xl', 28, { bleed: true, line: false })}
            <div class="vi-title stack" data-area="text:titel">
              <p class="t-16 w-500 clip">${h.esc(d.title)}</p>
              <p class="t-12 clip">${h.esc(d.channel)} · ${h.esc(d.date)}</p>
            </div>
            <div class="vi-ctl" data-area="control:steuerung">
              ${track(d)}
              <div class="row between">
                <p class="t-12">${playtime(d)}</p>
                <div class="row g-8">
                  <button class="btn-round sm ghost vi-btn" aria-label="Ton">${h.icon('volume', 20)}</button>
                  <button class="btn-round sm ghost vi-btn" aria-label="Vollbild beenden">${h.icon('close', 20)}</button>
                </div>
              </div>
            </div>
          </div>`,
      },
    ],
  });
})();
