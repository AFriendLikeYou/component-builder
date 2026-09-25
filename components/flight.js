(() => {
  // Flug verfolgen: Strecke mit dem Flugzeug auf dem Fortschritt, Karte mit Bogen, Verlauf der Stationen.
  // Restzeit steht als „h:mm“ in data und wird erst beim Rendern ausgeschrieben („1 Std. 18 Min.“).
  const dur = s => {
    const [hh, mm] = String(s).split(':').map(Number);
    return [hh ? `${hh} Std.` : '', mm ? `${mm} Min.` : ''].filter(Boolean).join(' ') || 'wenigen Min.';
  };
  const MAX = 5; // mehr Stationen: vier zeigen, dazu „4 von 12 · Alle anzeigen“
  let uid = 0;

  const head = (d, h) => `
    <div class="row between g-16" data-area="text:kopf">
      <p class="t-16 w-500 clip">${h.esc(d.flight)}</p>
      <span class="chip t-12 w-500 ft-status"><span class="clip">${h.esc(d.status)}</span></span>
    </div>`;

  // Bogen von Abflug zu Ziel (quadratische Bézierkurve), geteilt am Fortschritt: geflogen durchgezogen, Rest gepunktet.
  function map(d, h, w, H) {
    const P0 = [w * 0.2, 112], P2 = [w * 0.8, 144], C = [w * 0.5, 40];
    const t = Math.min(1, Math.max(0, d.progress));
    const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const Q0 = lerp(P0, C, t), Q1 = lerp(C, P2, t), B = lerp(Q0, Q1, t);
    // Das Flugzeug wird in Flugrichtung gedreht (Tangente am Teilungspunkt); „plane“ zeigt von sich aus 45° nach oben.
    const ang = Math.atan2(Q1[1] - Q0[1], Q1[0] - Q0[0]) * 180 / Math.PI;
    const f = n => n.toFixed(1), pt = p => `${f(p[0])} ${f(p[1])}`;
    const id = `ft-p${++uid}`;
    const label = (p, a, side) => `
      <text x="${f(p[0] + side * 12)}" y="${f(p[1] - 2)}" text-anchor="${side < 0 ? 'end' : 'start'}" class="ft-code">${h.esc(a.code)}</text>
      <text x="${f(p[0] + side * 12)}" y="${f(p[1] + 14)}" text-anchor="${side < 0 ? 'end' : 'start'}" class="ft-when">${h.esc(a.time)}</text>`;
    return `<svg class="ft-svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" aria-hidden="true">
      <defs><pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="1.25" class="ft-grain"/></pattern></defs>
      <rect width="${w}" height="${H}" fill="url(#${id})"/>
      <path d="M${pt(B)} Q${pt(Q1)} ${pt(P2)}" class="ft-rest"/>
      <path d="M${pt(P0)} Q${pt(Q0)} ${pt(B)}" class="ft-flown"/>
      <circle cx="${f(P0[0])}" cy="${f(P0[1])}" r="5" class="ft-end is-from"/>
      <circle cx="${f(P2[0])}" cy="${f(P2[1])}" r="5" class="ft-end"/>
      ${label(P0, d.from, -1)}${label(P2, d.to, 1)}
      <g transform="translate(${pt(B)})">
        <circle r="16" class="ft-jet"/>
        <g transform="rotate(${f(ang + 45)}) translate(-10 -10)">${h.icon('plane', 20)}</g>
      </g>
    </svg>`;
  }

  Factory.register({
    id: 'flight',
    name: 'Flug',
    aliases: ['flight', 'flighttracker', 'flight tracker', 'flug', 'flugstatus', 'flugzeug', 'tracker'],
    data: {
      flight: 'EW 7412',
      status: 'In der Luft',
      from: { code: 'HAM', city: 'Hamburg', time: '14:05' },
      to: { code: 'ATH', city: 'Athen', time: '18:10' },
      progress: 0.58,
      remaining: '1:18',
      alt: '11.280 m',
      speed: '846 km/h',
      steps: [
        { time: '13:25', what: 'Boarding', where: 'Gate B12', done: true },
        { time: '14:05', what: 'Abflug', where: 'Hamburg', done: true },
        { time: '14:31', what: 'Reiseflughöhe', where: '11.280 m', done: true },
        { time: '18:10', what: 'Landung', where: 'Athen' },
        { time: '18:35', what: 'Gepäck', where: 'Band 4' },
      ],
    },
    css: `
      .ft-status { max-width: 50%; background: var(--c-accent-soft); color: var(--c-accent); }
      .ft-r { text-align: right; min-width: 0; }

      /* Strecke: Kürzel groß, dazwischen der Weg mit dem Flugzeug, darunter Zeiten und Werte */
      .ft-s { display: flex; flex-direction: column; gap: 16px; }
      .ft-leg { display: flex; flex-direction: column; gap: 8px; }
      .ft-route { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 16px; height: 40px; }
      .ft-path { position: relative; height: 24px; }
      .ft-path::before { content: ''; position: absolute; left: 0; right: 0; top: 10px; height: 4px; background: radial-gradient(circle, var(--c-ink-3) 1px, transparent 1.5px) 0 50% / 6px 4px repeat-x; }
      /* geflogener Teil: Baustein Fortschritt ohne eigene Spur, der Rest bleibt gepunktet */
      .ft-done { position: absolute; left: 0; right: 0; top: 10px; background: transparent; }
      .ft-pin { position: absolute; top: 8px; width: 8px; height: 8px; border-radius: var(--r-pill); }
      .ft-pin.is-from { left: 0; background: var(--c-accent); }
      .ft-pin.is-to { right: 0; background: var(--c-surface); box-shadow: inset 0 0 0 2px var(--c-ink-3); }
      .ft-plane { position: absolute; top: 0; left: calc(var(--p) * 100%); width: 24px; height: 24px; margin-left: -12px; display: grid; place-items: center; background: var(--c-surface); color: var(--c-accent); }
      .ft-plane .icon { transform: rotate(45deg); }
      .ft-times > .stack { flex: 1 1 0; min-width: 0; }
      .ft-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding: 8px 16px; border-radius: var(--r-16); background: var(--c-fill); }
      /* ZDS erlaubt für Flächen höchstens 8 px Radius */
      .ft-stats.is-zds { border-radius: var(--r-8); }

      /* Karte: randabfallender Kartenausschnitt mit Bogen, darunter Strecke und Ankunft */
      .ft-k { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 208px 24px 40px; height: 100%; }
      .ft-map { grid-row: 1; display: grid; background: var(--c-accent-soft); overflow: hidden; }
      .ft-map > * { grid-area: 1 / 1; }
      .ft-map .ft-status { align-self: start; justify-self: start; margin: 24px; background: var(--c-surface); }
      .ft-svg { display: block; }
      .ft-grain { fill: var(--c-accent); fill-opacity: .2; }
      .ft-flown { fill: none; stroke: var(--c-accent); stroke-width: 2.5; stroke-linecap: round; }
      .ft-rest { fill: none; stroke: var(--c-accent); stroke-opacity: .48; stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 0 6; }
      .ft-end { fill: var(--c-surface); stroke: var(--c-accent); stroke-width: 2; }
      .ft-end.is-from { fill: var(--c-accent); }
      .ft-code { font-size: 12px; font-weight: 500; fill: var(--c-ink); }
      .ft-when { font-size: 12px; fill: var(--c-ink-2); font-variant-numeric: tabular-nums; }
      .ft-jet { fill: var(--c-surface); filter: drop-shadow(0 4px 8px rgba(0, 0, 0, .16)); }
      .ft-svg .icon { color: var(--c-accent); }
      .ft-k .ft-row { grid-row: 3; margin: 0 24px; display: flex; gap: 16px; }

      /* Verlauf: Stationen an einer Linie, die nächste ist blau markiert */
      .ft-v { display: flex; flex-direction: column; gap: 16px; }
      .ft-list { display: flex; flex-direction: column; gap: 8px; }
      .ft-step { position: relative; height: 32px; display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; column-gap: 16px; align-items: center; }
      .ft-step::before { content: ''; position: absolute; left: 7px; top: 16px; width: 2px; height: 40px; background: var(--c-fill-2); }
      .ft-step.is-done::before { background: var(--c-accent); }
      .ft-step.is-last::before { display: none; }
      .ft-dot { position: relative; justify-self: center; width: 8px; height: 8px; border-radius: var(--r-pill); background: var(--c-surface); box-shadow: inset 0 0 0 2px var(--c-ink-3); }
      .is-done .ft-dot { background: var(--c-accent); box-shadow: none; }
      .is-next .ft-dot { width: 12px; height: 12px; background: var(--c-surface); box-shadow: inset 0 0 0 2px var(--c-accent), 0 0 0 4px var(--c-accent-soft); }
      .is-next .ft-what { color: var(--c-accent); }
      .ft-step .ft-time { align-self: start; }
      .ft-more { height: 32px; }
      .ft-link { height: 32px; padding: 0 8px; margin-right: -8px; color: var(--c-accent); }
      .ft-none { height: 192px; align-items: center; justify-content: center; gap: 16px; text-align: center; }
      .ft-badge { width: 48px; height: 48px; border-radius: var(--r-pill); display: grid; place-items: center; background: var(--c-fill); color: var(--c-ink-3); }

      /* Strecke · Bildstärker: randabfallendes Foto, Kürzel und Flugzeug darauf, darunter knapp Zeiten und Restzeit */
      .ft-b { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 232px 24px 40px; height: 100%; }
      .ft-bild { grid-row: 1; display: grid; grid-template-columns: minmax(0, 1fr); overflow: hidden; }
      .ft-bild > * { grid-area: 1 / 1; position: relative; } /* cf-media ist positioniert; so malt alles danach darüber */
      .ft-foto { width: 100%; height: 100%; }
      .ft-scrim { align-self: end; height: 176px; background: linear-gradient(to top, color-mix(in srgb, var(--c-dark) 64%, transparent), transparent); }
      .ft-bild .ft-status { align-self: start; justify-self: start; margin: 24px; background: var(--c-surface); }
      .ft-bild .ft-route { align-self: end; margin: 24px; grid-template-columns: minmax(0, auto) minmax(48px, 1fr) minmax(0, auto); color: var(--c-on-dark); }
      .ft-track { position: relative; height: 32px; display: grid; align-items: center; }
      .ft-bild .ft-plane { width: 32px; height: 32px; margin-left: -16px; border-radius: var(--r-pill); box-shadow: 0 4px 12px -4px rgba(0, 0, 0, .4); }
      .ft-unter { grid-row: 3; margin: 0 24px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr); gap: 16px; }
      .ft-unter > .stack { min-width: 0; }
      .ft-c { text-align: center; min-width: 0; }
    `,
    layouts: [
      {
        id: 'strecke',
        name: 'Strecke',
        family: 'karte',
        idea: 'Die Strecke zuerst: Abflug- und Zielkürzel groß, dazwischen sitzt das Flugzeug dort, wo der Flug gerade ist.',
        height: 248,
        render: (d, h) => `
          <div class="ft-s">
            ${head(d, h)}
            <div class="ft-leg">
              <div class="ft-route" data-area="text:strecke">
                <p class="t-32 w-500">${h.esc(d.from.code)}</p>
                <div class="ft-path" style="--p:${Math.min(1, Math.max(0, d.progress))}">
                  <span class="ft-pin is-from"></span><span class="ft-pin is-to"></span>
                  <div class="progress accent ft-done"><i></i></div>
                  <span class="ft-plane">${h.icon('plane', 20)}</span>
                </div>
                <p class="t-32 w-500">${h.esc(d.to.code)}</p>
              </div>
              <div class="row between g-16 ft-times" data-area="meta:zeiten">
                <div class="stack"><p class="t-16 w-500 num">${h.esc(d.from.time)}</p><p class="t-12 ink-2 clip">${h.esc(d.from.city)}</p></div>
                <div class="stack ft-r"><p class="t-16 w-500 num">${h.esc(d.to.time)}</p><p class="t-12 ink-2 clip">${h.esc(d.to.city)}</p></div>
              </div>
            </div>
            <div class="ft-stats${h.S.id === 'zds' ? ' is-zds' : ''}" data-area="meta:werte">
              ${[['Höhe', d.alt], ['Tempo', d.speed], ['Landung in', `${d.remaining} h`]].map(([k, v]) => `
                <div class="stack"><p class="t-12 ink-2 clip">${k}</p><p class="t-16 w-500 num clip">${h.esc(v)}</p></div>`).join('')}
            </div>
          </div>`,
      },
      {
        id: 'karte',
        name: 'Karte',
        family: 'karte',
        idea: 'Das Bild zuerst: ein randabfallender Kartenausschnitt mit dem Bogen von Hamburg nach Athen und dem Flugzeug darauf.',
        height: 296,
        padding: 0,
        render: (d, h) => `
          <div class="ft-k">
            <div class="ft-map" data-bleed data-area="media:karte">
              ${map(d, h, h.width || 352, 208)}
              <span class="chip t-12 w-500 ft-status"><span class="clip">${h.esc(d.status)}</span></span>
            </div>
            <div class="ft-row" data-area="text:flug">
              <div class="stack grow">
                <p class="t-16 w-500 clip">${h.esc(d.from.city)} → ${h.esc(d.to.city)}</p>
                <p class="t-12 ink-2 clip">${h.esc(d.flight)} · noch ${dur(d.remaining)}</p>
              </div>
              <div class="stack ft-r">
                <p class="t-16 w-500 num">${h.esc(d.to.time)}</p>
                <p class="t-12 ink-2">Ankunft</p>
              </div>
            </div>
          </div>`,
      },
      {
        id: 'verlauf',
        name: 'Verlauf',
        family: 'karte',
        idea: 'Die Liste zuerst: alle Stationen vom Boarding bis zum Gepäckband an einer Linie, die nächste ist blau und nennt die Restzeit.',
        height: 280,
        render: (d, h) => {
          const all = d.steps;
          if (!all.length) return `
            <div class="ft-v">
              ${head(d, h)}
              <div class="ft-list ft-none" data-area="text:verlauf">
                <span class="ft-badge">${h.icon('plane', 24)}</span>
                <div class="stack">
                  <p class="t-14 w-500">Noch keine Stationen</p>
                  <p class="t-12 ink-2">Sobald der Flug startet, steht hier der Verlauf.</p>
                </div>
              </div>
            </div>`;
          const next = all.findIndex(s => !s.done);
          const more = all.length > MAX, n = more ? MAX - 1 : all.length;
          // Bei vielen Stationen ein Fenster um die nächste zeigen
          const start = more ? Math.max(0, Math.min((next < 0 ? all.length : next) - 2, all.length - n)) : 0;
          const shown = all.slice(start, start + n);
          return `
            <div class="ft-v">
              ${head(d, h)}
              <div class="ft-list" data-area="text:verlauf">
                ${shown.map((s, k) => {
                  const i = start + k, isNext = i === next;
                  return `
                  <div class="ft-step${s.done ? ' is-done' : ''}${isNext ? ' is-next' : ''}${k === shown.length - 1 ? ' is-last' : ''}" data-area="text:station-${k + 1}">
                    <span class="ft-dot"></span>
                    <div class="stack">
                      <p class="t-14 tight w-500 clip ft-what">${h.esc(s.what)}</p>
                      <p class="t-12 ink-2 clip">${h.esc(s.where)}${isNext ? ` · in ${dur(d.remaining)}` : ''}</p>
                    </div>
                    <p class="t-12 ink-2 num ft-time">${h.esc(s.time)}</p>
                  </div>`;
                }).join('')}
                ${more ? `
                <div class="row between ft-more" data-area="control:alle">
                  <p class="t-12 ink-2">${n} von ${all.length} Stationen</p>
                  <button class="btn-text t-12 w-500 ft-link">Alle anzeigen</button>
                </div>` : ''}
              </div>
            </div>`;
        },
      },
      {
        id: 'strecke-bildstaerker',
        name: 'Strecke · Bildstärker',
        family: 'karte',
        variantOf: 'strecke',
        direction: 'bildstaerker',
        idea: 'Ein randabfallendes Foto füllt zwei Drittel der Karte, Kürzel und Flugzeug stehen groß darauf statt auf Weiß. Darunter bleiben nur Zeiten und Restzeit, genau unter ihren Kürzeln – so führt das Bild, und die Strecke liest sich wie im Original.',
        height: 320,
        padding: 0,
        render: (d, h) => {
          const p = Math.min(1, Math.max(0, d.progress));
          return `
          <div class="ft-b">
            <div class="ft-bild" data-bleed data-area="media:bild">
              ${h.media(0, { class: 'ft-foto' })}
              <span class="ft-scrim"></span>
              <span class="chip t-12 w-500 ft-status"><span class="clip">${h.esc(d.flight)} · ${h.esc(d.status)}</span></span>
              <div class="ft-route" data-area="text:strecke">
                <p class="t-32 w-500 clip">${h.esc(d.from.code)}</p>
                <div class="ft-track" style="--p:${p}">
                  <div class="progress on-media"><i></i></div>
                  <span class="ft-plane">${h.icon('plane', 20)}</span>
                </div>
                <p class="t-32 w-500 clip">${h.esc(d.to.code)}</p>
              </div>
            </div>
            <div class="ft-unter" data-area="meta:zeiten">
              <div class="stack"><p class="t-16 w-500 num">${h.esc(d.from.time)}</p><p class="t-12 ink-2 clip">${h.esc(d.from.city)}</p></div>
              <div class="stack ft-c"><p class="t-16 w-500 num clip">${dur(d.remaining)}</p><p class="t-12 ink-2 clip">bis zur Landung</p></div>
              <div class="stack ft-r"><p class="t-16 w-500 num">${h.esc(d.to.time)}</p><p class="t-12 ink-2 clip">${h.esc(d.to.city)}</p></div>
            </div>
          </div>`;
        },
      },
    ],
  });
})();
