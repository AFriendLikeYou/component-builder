(() => {
  const DIR = ['Nord', 'Nordnordost', 'Nordost', 'Ostnordost', 'Ost', 'Ostsüdost', 'Südost', 'Südsüdost',
    'Süd', 'Südsüdwest', 'Südwest', 'Westsüdwest', 'West', 'Westnordwest', 'Nordwest', 'Nordnordwest'];
  const SHORT = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const CARD = { 0: 'N', 90: 'O', 180: 'S', 270: 'W' };
  const idx = a => Math.round((((a % 360) + 360) % 360) / 22.5) % 16;
  const rel = (b, heading) => ((b - heading + 540) % 360) - 180;
  const km = m => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
  const label = (x, y, text, fill, weight) =>
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="14" text-anchor="middle" dominant-baseline="central" fill="${fill}" style="font-family:var(--f-ui);font-weight:${weight}">${text}</text>`;

  // Kompassrose: die Scheibe dreht sich, der Strich oben bleibt stehen und zeigt den Kurs. Norden ist warm.
  function rose(d, size) {
    const c = size / 2;
    let ticks = '', labels = '';
    for (let a = 0; a < 360; a += 2) {
      const major = a % 30 === 0, north = a === 0;
      const r2 = north ? 100 : major ? 106 : a % 10 === 0 ? 112 : 115;
      ticks += `<line x1="${c}" y1="${c - 120}" x2="${c}" y2="${c - r2}" stroke="${north ? 'var(--c-warm)' : 'currentColor'}" stroke-opacity="${major ? 1 : .35}" stroke-width="${north ? 3 : major ? 2 : 1}" stroke-linecap="round" transform="rotate(${a - d.heading} ${c} ${c})"/>`;
    }
    for (let a = 0; a < 360; a += 30) {
      const t = (a - d.heading - 90) * Math.PI / 180;
      const x = c + Math.cos(t) * 88, y = c + Math.sin(t) * 88;
      labels += CARD[a] != null
        ? label(x, y, CARD[a], a === 0 ? 'var(--c-warm)' : 'currentColor', 500)
        : label(x, y, a, 'var(--c-on-dark-2)', 400);
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${c}" cy="${c}" r="${c}" fill="var(--c-dark-2)"/>
      ${ticks}${labels}
      <line x1="${c}" y1="2" x2="${c}" y2="26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }

  // Gradband: Striche alle 5°, Beschriftung alle 30°, der warme Strich in der Mitte ist der Kurs.
  function tape(d, w) {
    const px = 3, c = w / 2;
    let out = '';
    for (let a = Math.ceil((d.heading - c / px) / 5) * 5; a <= d.heading + c / px; a += 5) {
      const x = c + (a - d.heading) * px, n = ((a % 360) + 360) % 360, major = n % 30 === 0;
      out += `<line x1="${x}" x2="${x}" y1="${major ? 24 : 30}" y2="40" stroke="${major ? 'currentColor' : 'var(--c-ink-3)'}" stroke-width="${major ? 2 : 1}" stroke-linecap="round"/>`;
      if (major) out += CARD[n] != null ? label(x, 8, CARD[n], 'currentColor', 500) : label(x, 8, n, 'var(--c-ink-2)', 400);
    }
    return `<svg width="${w}" height="48" viewBox="0 0 ${w} 48" aria-hidden="true">
      ${out}
      <path d="M${c - 6} 15 L${c + 6} 15 L${c} 23 Z" fill="var(--c-warm)" stroke="var(--c-warm)" stroke-width="2" stroke-linejoin="round"/>
      <line x1="${c}" x2="${c}" y1="20" y2="46" stroke="var(--c-warm)" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }

  Factory.register({
    id: 'compass',
    name: 'Kompass',
    aliases: ['compass', 'kompass', 'richtung', 'himmelsrichtung', 'kurs', 'navigation', 'peilung'],
    data: {
      heading: 312,
      place: 'Hamburg',
      lat: '53°33′ N',
      lon: '9°59′ O',
      alt: '12 m ü. NN',
      targets: [
        { name: 'Planten un Blomen', bearing: 300, dist: 900 },
        { name: 'Hauptbahnhof', bearing: 112, dist: 1100 },
        { name: 'Elbphilharmonie', bearing: 204, dist: 1800 },
        { name: 'Stadtpark', bearing: 24, dist: 4900 },
      ],
    },
    css: `
      .ko-dial svg, .ko-tape svg { display: block; }

      .ko-rose { display: flex; flex-direction: column; gap: 16px; }
      .ko-dial { position: relative; width: 256px; height: 256px; align-self: center; border-radius: 999px; }
      .ko-mid { position: absolute; left: 48px; top: 80px; width: 160px; height: 96px; display: flex; flex-direction: column; align-items: center; justify-content: center; }

      .ko-course { display: flex; flex-direction: column; gap: 24px; }
      .ko-val { height: 64px; display: grid; grid-template-columns: 160px 144px; }
      .ko-val .end { justify-content: flex-end; align-items: flex-end; padding-bottom: 4px; }
      .ko-tape { height: 48px; mask-image: linear-gradient(90deg, transparent, #000 24%, #000 76%, transparent); }

      .ko-goals { display: flex; flex-direction: column; gap: 16px; }
      .ko-list { display: flex; flex-direction: column; gap: 8px; }
      .ko-item { height: 48px; display: flex; align-items: center; gap: 16px; }
      .ko-dir { width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center; background: var(--c-fill); flex: none; }
      .ko-dir .icon { transform: rotate(var(--r)); }
      .ko-item.is-next .ko-dir { background: var(--c-warm); color: var(--c-dark); }
    `,
    layouts: [
      {
        id: 'rose',
        name: 'Rose',
        idea: 'Das Instrument zuerst: eine dunkle Rose, die sich mitdreht, der Kurs steht groß in ihrer Mitte.',
        height: 384,
        dark: true,
        render: (d, h) => `
          <div class="ko-rose">
            <div class="row between" data-area="text:kopf">
              <p class="t-16 w-500">Kompass</p>
              <p class="t-14 ink-2">${h.esc(d.place)}</p>
            </div>
            <div class="ko-dial" data-area="media:rose">
              ${rose(d, 256)}
              <div class="ko-mid" data-area="text:kurs">
                <p class="t-48 num" data-role="Kurs">${d.heading}°</p>
                <p class="t-14 ink-2">${DIR[idx(d.heading)]}</p>
              </div>
            </div>
            <div class="row between" data-area="meta:position">
              <p class="t-14 num">${d.lat} · ${d.lon}</p>
              <p class="t-14 ink-2 num">${d.alt}</p>
            </div>
          </div>`,
      },
      {
        id: 'kurs',
        name: 'Kurs',
        idea: 'Der Wert zuerst: 312° groß, darunter ein Gradband, auf dem der Kurs als warmer Strich steht.',
        height: 184,
        render: (d, h) => `
          <div class="ko-course">
            <div class="ko-val">
              <p class="t-64 num" data-area="text:kurs" data-role="Kurs">${d.heading}°</p>
              <div class="stack end" data-area="text:lage">
                <p class="t-16 w-500">${DIR[idx(d.heading)]}</p>
                <p class="t-14 ink-2 num">${d.lat} · ${d.lon}</p>
              </div>
            </div>
            <div class="ko-tape" data-area="media:gradband">${tape(d, 304)}</div>
          </div>`,
      },
      {
        id: 'ziele',
        name: 'Ziele',
        idea: 'Wohin von hier: die Ziele als Liste, jeder Pfeil zeigt relativ zum Kurs, das nächste ist warm.',
        height: 304,
        render: (d, h) => `
          <div class="ko-goals">
            <div class="row between" data-area="text:kopf">
              <p class="t-16 w-500">Ziele</p>
              <p class="t-14 ink-2 num">Kurs ${d.heading}° ${SHORT[idx(d.heading)]}</p>
            </div>
            <div class="ko-list" data-area="text:liste">
              ${d.targets.map((t, i) => `
                <div class="ko-item${i === 0 ? ' is-next' : ''}" data-area="text:ziel-${i + 1}">
                  <span class="ko-dir" style="--r:${rel(t.bearing, d.heading) - 90}deg">${h.icon('arrow-right', 20)}</span>
                  <div class="stack grow">
                    <p class="t-14 tight w-500 clip">${h.esc(t.name)}</p>
                    <p class="t-12 ink-2 num clip">${DIR[idx(t.bearing)]} · ${t.bearing}°</p>
                  </div>
                  <p class="t-14 num">${km(t.dist)}</p>
                </div>`).join('')}
            </div>
          </div>`,
      },
    ],
  });
})();
