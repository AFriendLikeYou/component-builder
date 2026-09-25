(() => {
  // Analoges Zifferblatt. Der Winkel steht per SVG-transform fest, .cf-spin lässt die Zeiger weiterlaufen.
  function face(z, { size, dark, numerals }) {
    const hA = (z.h % 12) * 30 + z.m * 0.5 + z.s / 120;
    const mA = z.m * 6 + z.s * 0.1;
    const sA = z.s * 6;
    const ink = dark ? '#f4f4f5' : '#1b2029';
    const tick = dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.28)';
    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const long = i % 5 === 0;
      ticks += `<line x1="100" y1="${long ? 12 : 13}" x2="100" y2="${long ? 22 : 17}" stroke="${tick}" stroke-width="${long ? 2 : 1}" stroke-linecap="round" transform="rotate(${i * 6} 100 100)"/>`;
    }
    // Ziffern: effektive Größe 16 px, egal wie groß das Blatt gezeichnet wird
    const fs = (16 * 200) / size;
    const nums = numerals ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n, i) => {
      const a = (i * 30 - 90) * Math.PI / 180;
      return `<text x="${100 + Math.cos(a) * 66}" y="${100 + Math.sin(a) * 66}" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="${ink}" style="font-family:var(--f-ui);font-weight:400">${n}</text>`;
    }).join('') : '';
    const hand = (angle, dur, body) => `<g transform="rotate(${angle} 100 100)"><g class="cf-spin" style="--dur:${dur}s">${body}</g></g>`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 200 200" style="display:block">
      <circle cx="100" cy="100" r="99" fill="${dark ? '#1b2029' : '#f5f5f3'}"/>
      <circle cx="100" cy="100" r="98.5" fill="none" stroke="${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}"/>
      ${ticks}${nums}
      ${hand(hA, 43200, `<line x1="100" y1="112" x2="100" y2="56" stroke="${ink}" stroke-width="7" stroke-linecap="round"/>`)}
      ${hand(mA, 3600, `<line x1="100" y1="114" x2="100" y2="30" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/>`)}
      ${hand(sA, 60, `<line x1="100" y1="122" x2="100" y2="24" stroke="var(--c-warm)" stroke-width="1.6" stroke-linecap="round"/>`)}
      <circle cx="100" cy="100" r="5" fill="var(--c-warm)"/>
    </svg>`;
  }

  const offset = (z, base) => {
    const diff = Math.round((Date.UTC(z.year, z.month - 1, z.day, z.h, z.m) - Date.UTC(base.year, base.month - 1, base.day, base.h, base.m)) / 36e5);
    return diff === 0 ? 'Ortszeit' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} Std.`;
  };

  const head = d => `
    <div class="row between" data-area="text:kopf">
      <p class="t-16 w-500">${d.title}</p>
      <span class="chip t-12 ink-2">24 h</span>
    </div>`;

  Factory.register({
    id: 'worldclock',
    name: 'Weltzeit',
    aliases: ['world clock', 'uhr', 'clock', 'zeitzonen'],
    data: {
      title: 'Weltzeit',
      cities: [
        { name: 'Hamburg', tz: 'Europe/Berlin' },
        { name: 'New York', tz: 'America/New_York' },
        { name: 'Tokio', tz: 'Asia/Tokyo' },
      ],
    },
    css: `
      .wc { display: flex; flex-direction: column; gap: 16px; height: 100%; }
      .wc-faces { display: grid; grid-template-columns: repeat(3, 96px); gap: 8px; }
      .wc-col { display: flex; flex-direction: column; align-items: center; }
      .wc-col svg { margin-bottom: 8px; border-radius: 50%; box-shadow: 0 8px 16px -8px rgba(0,0,0,.18); }
      .wc-rows { display: flex; flex-direction: column; gap: 16px; }
      .wc-row { height: 40px; display: flex; justify-content: space-between; }
      .wc-row .end { text-align: right; }
      .wc-big { align-self: center; border-radius: 50%; }
      .wc-big svg { border-radius: 50%; box-shadow: 0 16px 32px -16px rgba(0,0,0,.25); }
    `,
    layouts: [
      {
        id: 'zifferblaetter',
        name: 'Zifferblätter',
        idea: 'Tag und Nacht auf einen Blick: drei Blätter nebeneinander, das nächtliche ist dunkel.',
        height: 216,
        render: (d, h) => `
          <div class="wc">
            ${head(d)}
            <div class="wc-faces">
              ${d.cities.map((c, i) => {
                const z = h.zoned(c.tz);
                return `<div class="wc-col" data-area="media:blatt-${i + 1}">
                  ${face(z, { size: 88, dark: z.night })}
                  <p class="t-12 w-500">${h.esc(c.name)}</p>
                  <p class="t-12 ink-2 num">${z.time}</p>
                </div>`;
              }).join('')}
            </div>
          </div>`,
      },
      {
        id: 'tabelle',
        name: 'Tabelle',
        idea: 'Zum Vergleichen: Uhrzeit groß rechts, Datum und Abstand zur Ortszeit leise daneben.',
        height: 240,
        render: (d, h) => {
          const base = h.zoned(d.cities[0].tz);
          return `
          <div class="wc">
            ${head(d)}
            <div class="wc-rows">
              ${d.cities.map((c, i) => {
                const z = h.zoned(c.tz);
                return `<div class="wc-row" data-area="text:stadt-${i + 1}">
                  <div class="stack"><p class="t-16 w-500">${h.esc(c.name)}</p><p class="t-12 ink-2">${z.date}</p></div>
                  <div class="stack end"><p class="t-20 num">${z.time}</p><p class="t-12 ink-2">${offset(z, base)}</p></div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        },
      },
      {
        id: 'fokus',
        name: 'Fokus',
        idea: 'Eine Stadt, ein großes Blatt: Ziffern nur hier, weil genug Platz für sie ist.',
        height: 384,
        render: (d, h) => {
          const c = d.cities[0], z = h.zoned(c.tz);
          return `
          <div class="wc">
            ${head(d)}
            <div class="wc-big" data-area="media:blatt">${face(z, { size: 240, dark: false, numerals: true })}</div>
            <div class="wc-row" data-area="text:stadt">
              <div class="stack"><p class="t-16 w-500">${h.esc(c.name)}</p><p class="t-12 ink-2">${z.date}</p></div>
              <p class="t-20 num" style="align-self:center">${z.time}</p>
            </div>
          </div>`;
        },
      },
    ],
  });
})();
