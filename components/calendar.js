(() => {
  const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  // Monatsraster Mo–So: Tage des Vor- und Folgemonats füllen die erste und letzte Woche auf.
  function cells(d) {
    const lead = (new Date(d.year, d.month - 1, 1).getDay() + 6) % 7;
    const days = new Date(d.year, d.month, 0).getDate();
    const prev = new Date(d.year, d.month - 1, 0).getDate();
    const rows = Math.ceil((lead + days) / 7);
    return Array.from({ length: rows * 7 }, (_, i) => {
      const n = i - lead + 1;
      if (n < 1) return { n: prev + n, out: true };
      if (n > days) return { n: n - days, out: true };
      return { n, today: n === d.day, busy: d.busy.includes(n) };
    });
  }

  const day = (c, h) => `<div class="ka-d${c.out ? ' is-out' : ''}${c.today ? ' is-today' : ''}${c.busy ? ' has' : ''}"><span class="t-14 num">${c.n}</span></div>`;

  // Kopf wie ein Tagesblatt: Wochentag klein über dem Tag, daneben Monat und Jahr, rechts blättern.
  const head = (d, h, [prev, next]) => `
    <div class="ka-head">
      <div class="ka-blatt" data-area="text:tag">
        <p class="t-12 w-500 ka-wd">${h.esc(d.weekday)}</p>
        <p class="t-48 num" data-role="Tag">${h.pad2(d.day)}</p>
      </div>
      <div class="ka-mon" data-area="text:monat">
        <p class="t-14 w-500">${h.esc(d.monthName)}</p>
        <p class="t-14 ink-2 num">${d.year}</p>
      </div>
      <div class="ka-nav" data-area="control:blaettern">
        <button class="btn-round sm" aria-label="${prev}">${h.icon('chevron-left', 18)}</button>
        <button class="btn-round sm" aria-label="${next}">${h.icon('chevron-right', 18)}</button>
      </div>
    </div>`;

  Factory.register({
    id: 'calendar',
    name: 'Kalender',
    aliases: ['calendar', 'kalender', 'termine', 'agenda', 'datum', 'monat', 'woche'],
    data: {
      weekday: 'SA',
      day: 5,
      month: 9,
      monthName: 'September',
      year: 2026,
      busy: [1, 3, 8, 10, 14, 17, 22, 24, 29],
      events: [
        { title: 'Arbeitsblock', start: '10:15', end: '11:15', place: 'Fokuszeit', now: true },
        { title: 'Studio-Review', start: '12:00', end: '13:00', place: 'Raum Elbe' },
        { title: 'Lauf an der Alster', start: '18:30', end: '19:30', place: 'Alte Rabenstraße' },
      ],
    },
    css: `
      .ka { display: flex; flex-direction: column; gap: 24px; }

      .ka-head { display: grid; grid-template-columns: 64px 1fr 72px; column-gap: 16px; align-items: end; height: 72px; }
      .ka-blatt { height: 72px; display: flex; flex-direction: column; }
      .ka-wd { color: var(--c-accent); letter-spacing: .08em; }
      .ka-mon { height: 48px; display: flex; flex-direction: column; }
      .ka-nav { height: 32px; margin-bottom: 8px; display: flex; gap: 8px; }

      /* Raster: 7 Spalten + 6 × 4 px füllen die Breite (Fabrik 7 × 40 px = 304 px) */
      .ka-cols { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); column-gap: 4px; }
      .ka-wds { height: 16px; }
      .ka-wds p { text-align: center; }
      .ka-wds .is-today { color: var(--c-accent); }
      .ka-raster { display: flex; flex-direction: column; gap: 8px; }
      .ka-tage { grid-auto-rows: 32px; row-gap: 4px; }

      .ka-d { position: relative; display: grid; place-items: center; }
      .ka-d span { width: 32px; height: 32px; border-radius: var(--r-pill); display: grid; place-items: center; }
      .ka-d.is-out { color: var(--c-ink-3); }
      .ka-d.is-today span { background: var(--c-accent); color: var(--c-surface); font-weight: 500; }
      .ka-d.has::after { content: ''; position: absolute; left: 50%; bottom: 1px; width: 4px; height: 4px; margin-left: -2px; border-radius: var(--r-pill); background: var(--c-ink-3); }

      .ka-woche { display: flex; flex-direction: column; gap: 8px; height: 72px; padding: 8px 0; border-radius: var(--r-16); background: var(--c-fill); }
      .ka-woche .ka-cols { grid-template-columns: repeat(7, 1fr); column-gap: 0; }

      /* Termine: der laufende als Block, die übrigen mit Randlinie */
      .ka-list { display: flex; flex-direction: column; gap: 8px; }
      .ka-ev { border-radius: var(--r-8); padding: 0 16px; }
      .ka-ev.is-now { background: var(--c-accent); color: var(--c-surface); }
      .ka-ev.is-now .ink-2 { color: var(--c-accent-soft); }
      .ka-ev:not(.is-now) { border-radius: 0; border-left: 2px solid var(--c-accent); padding-left: 14px; }

      .ka-zeile { height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }

      .ka-agenda { display: flex; flex-direction: column; gap: 8px; }
      .ka-slot { height: 56px; display: grid; grid-template-columns: 40px 1fr; column-gap: 16px; }
      .ka-slot > .ka-zeit { padding-top: 12px; }
      .ka-slot .ka-ev { display: flex; flex-direction: column; justify-content: center; }
    `,
    layouts: [
      {
        id: 'monat',
        name: 'Monat',
        idea: 'Der ganze Monat auf einen Blick: das Raster Mo–So führt, heute ist ein Akzentkreis, Punkte zeigen belegte Tage.',
        height: 344,
        render: (d, h) => {
          const today = (new Date(d.year, d.month - 1, d.day).getDay() + 6) % 7;
          return `
          <div class="ka">
            ${head(d, h, ['Voriger Monat', 'Nächster Monat'])}
            <div class="ka-raster" data-area="text:raster">
              <div class="ka-cols ka-wds" data-area="meta:wochentage">
                ${WD.map((w, i) => `<p class="t-12 w-500 ink-3${i === today ? ' is-today' : ''}">${w}</p>`).join('')}
              </div>
              <div class="ka-cols ka-tage" data-area="text:tage">
                ${cells(d).map(c => day(c, h)).join('')}
              </div>
            </div>
          </div>`;
        },
      },
      {
        id: 'woche',
        name: 'Woche',
        idea: 'Die laufende Woche als Leiste, darunter kompakt die Termine von heute – der aktuelle als Block.',
        height: 376,
        render: (d, h) => {
          const all = cells(d);
          const i = all.findIndex(c => c.today);
          const week = all.slice(i - (i % 7), i - (i % 7) + 7);
          return `
          <div class="ka">
            ${head(d, h, ['Vorige Woche', 'Nächste Woche'])}
            <div class="ka-woche" data-area="text:woche">
              <div class="ka-cols ka-wds">
                ${WD.map((w, k) => `<p class="t-12 w-500 ink-3${week[k].today ? ' is-today' : ''}">${w}</p>`).join('')}
              </div>
              <div class="ka-cols ka-tage">${week.map(c => day({ ...c, out: false }, h)).join('')}</div>
            </div>
            <div class="ka-list" data-area="text:termine">
              ${d.events.map((e, k) => `
                <div class="ka-ev ka-zeile${e.now ? ' is-now' : ''}" data-area="text:termin-${k + 1}">
                  <p class="t-14 w-500 clip">${h.esc(e.title)}</p>
                  <p class="t-12 num ${e.now ? '' : 'ink-2'}">${e.now ? `${e.start}–${e.end}` : e.start}</p>
                </div>`).join('')}
            </div>
          </div>`;
        },
      },
      {
        id: 'tag',
        name: 'Tag',
        idea: 'Der Tag als Blatt: Datum oben, darunter die Termine nach Uhrzeit, der laufende steht als gefüllter Block.',
        height: 328,
        render: (d, h) => `
          <div class="ka">
            ${head(d, h, ['Voriger Tag', 'Nächster Tag'])}
            <div class="ka-agenda" data-area="text:termine">
              ${d.events.map((e, k) => `
                <div class="ka-slot" data-area="text:termin-${k + 1}">
                  <p class="t-12 ink-2 num ka-zeit">${e.start}</p>
                  <div class="ka-ev${e.now ? ' is-now' : ''}">
                    <p class="t-14 w-500 clip">${h.esc(e.title)}</p>
                    <p class="t-12 ink-2 clip">${e.now ? `Jetzt bis ${e.end}` : `bis ${e.end}`} · ${h.esc(e.place)}</p>
                  </div>
                </div>`).join('')}
            </div>
          </div>`,
      },
    ],
  });
})();
