(() => {
  // Mond: Phase, Beleuchtung und die nächsten Hauptphasen, aus h.now berechnet (Meeus, Astronomical Algorithms, Kap. 48 und 49 –
  // auf wenige Minuten genau). Tage und Uhrzeiten gelten in d.tz. Gezeichnet für die Nordhalbkugel: zunehmend ist rechts hell.
  const rad = x => x * Math.PI / 180, sin = x => Math.sin(rad(x)), cos = x => Math.cos(rad(x));
  const DAY = 864e5, SYN = 29.530588861;
  const f = n => n.toFixed(1);
  const jdOf = t => t / DAY + 2440587.5;
  const msOf = jde => (jde - 2440587.5) * DAY - 69e3; // Ephemeridenzeit → UTC (ΔT ≈ 69 s)
  let uid = 0;

  // Zeitpunkt der Hauptphase k: ganzzahlig = Neumond, +.25 Erstes Viertel, +.5 Vollmond, +.75 Letztes Viertel
  function phaseAt(k) {
    const T = k / 1236.85, q = ((k % 1) + 1) % 1;
    const jde = 2451550.09766 + SYN * k + 0.00015437 * T * T - 0.00000015 * T ** 3;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const M = 2.5534 + 29.1053567 * k - 0.0000014 * T * T;
    const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3;
    const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3;
    const O = 124.7746 - 1.56375588 * k + 0.0020672 * T * T;
    let c;
    if (q === 0 || q === 0.5) {
      const full = q === 0.5;
      c = (full ? -0.40614 : -0.4072) * sin(Mp) + (full ? 0.17302 : 0.17241) * E * sin(M) + (full ? 0.01614 : 0.01608) * sin(2 * Mp)
        + (full ? 0.01043 : 0.01039) * sin(2 * F) + (full ? 0.00734 : 0.00739) * E * sin(Mp - M) - (full ? 0.00515 : 0.00514) * E * sin(Mp + M)
        + (full ? 0.00209 : 0.00208) * E * E * sin(2 * M) - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M)
        - 0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F) - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(O);
    } else {
      c = -0.62801 * sin(Mp) + 0.17172 * E * sin(M) - 0.01183 * E * sin(Mp + M) + 0.00862 * sin(2 * Mp) + 0.00804 * sin(2 * F)
        + 0.00454 * E * sin(Mp - M) + 0.00204 * E * E * sin(2 * M) - 0.0018 * sin(Mp - 2 * F) - 0.0007 * sin(Mp + 2 * F) - 0.0004 * sin(3 * Mp)
        - 0.00034 * E * sin(2 * Mp - M) + 0.00032 * E * sin(M + 2 * F) + 0.00032 * E * sin(M - 2 * F) - 0.00028 * E * E * sin(Mp + 2 * M)
        + 0.00027 * E * sin(2 * Mp + M) - 0.00017 * sin(O);
      const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
      c += q < 0.5 ? W : -W;
    }
    return msOf(jde + c);
  }

  // Beleuchteter Anteil (0 bis 1) und Richtung zum Zeitpunkt t
  function light(t) {
    const T = (jdOf(t) - 2451545) / 36525;
    const D = 297.8501921 + 445267.1114034 * T, M = 357.5291092 + 35999.0502909 * T, Mp = 134.9633964 + 477198.8675055 * T;
    const i = 180 - D - 6.289 * sin(Mp) + 2.1 * sin(M) - 1.274 * sin(2 * D - Mp) - 0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.11 * sin(D);
    return { k: (1 + cos(i)) / 2, waxing: ((D % 360) + 360) % 360 < 180 };
  }

  const PHASES = ['Neumond', 'Erstes Viertel', 'Vollmond', 'Letztes Viertel'];
  const BETWEEN = ['Zunehmende Sichel', 'Zunehmender Mond', 'Abnehmender Mond', 'Abnehmende Sichel']; // nach der Hauptphase q
  const SHAPE = [{ k: 0, waxing: true }, { k: 0.5, waxing: true }, { k: 1, waxing: true }, { k: 0.5, waxing: false }];
  const MON = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni', 'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  // Hauptphasen um t herum, zeitlich sortiert: n Stück, beginnend einen Zyklus vor t (damit der letzte Neumond sicher dabei ist)
  function events(t, n) {
    const base = Math.floor((jdOf(t) - 2451550.09766) / SYN * 4) / 4 - 1;
    return Array.from({ length: n }, (_, i) => {
      const k = base + i / 4;
      return { q: Math.round((((k % 1) + 1) % 1) * 4) % 4, at: phaseAt(k) };
    });
  }

  // Kalendertage in der Zeitzone: Schlüssel JJJJ-MM-TT und Abstand in Tagen
  const keyOf = (t, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
  const dayNo = k => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / DAY;
  const rel = n => (n <= 0 ? 'heute' : n === 1 ? 'morgen' : `in ${n} Tagen`);
  const fmt = (t, tz, o) => new Intl.DateTimeFormat('de-DE', { timeZone: tz, ...o }).format(t);

  // Alles, was die Layouts über den Mond jetzt wissen müssen
  function now(d, h) {
    const t = h.now.getTime(), today = keyOf(t, d.tz), evs = events(t, 16);
    const past = evs.filter(e => e.at <= t), prev = past[past.length - 1];
    const newMoon = past.filter(e => e.q === 0).pop();
    const onDay = evs.find(e => keyOf(e.at, d.tz) === today);
    const next = evs.filter(e => e.at > t).map(e => ({ ...e, days: dayNo(keyOf(e.at, d.tz)) - dayNo(today) }));
    const m = light(t);
    return {
      m, next, today,
      name: onDay ? PHASES[onDay.q] : BETWEEN[prev.q],
      pct: Math.round(m.k * 100),
      age: Math.floor((t - newMoon.at) / DAY),
      goal: next.find(e => e.days > 0 && e.q % 2 === 0), // nächster Voll- oder Neumond nach heute
    };
  }

  // Heller Teil: Halbkreis auf der hellen Seite, zurück über den Terminator als Halbellipse mit rx = r · |2k − 1|
  function litPath(cx, cy, r, { k, waxing }) {
    const rx = Math.abs(2 * k - 1) * r, back = waxing === k > 0.5 ? 1 : 0;
    return `M${f(cx)} ${f(cy - r)} A${f(r)} ${f(r)} 0 0 ${waxing ? 1 : 0} ${f(cx)} ${f(cy + r)} A${f(rx)} ${f(r)} 0 0 ${back} ${f(cx)} ${f(cy - r)} Z`;
  }

  // Meere der Vorderseite (Mitte x, y und Halbachsen in Bruchteilen des Radius, Drehung in Grad)
  const MARIA = [
    [-0.52, 0.04, 0.26, 0.42, -12], [-0.24, -0.42, 0.24, 0.2, 0], [0.16, -0.36, 0.14, 0.13, 0], [0.3, -0.08, 0.17, 0.14, 8],
    [0.64, -0.26, 0.1, 0.08, 0], [0.55, 0.12, 0.1, 0.13, 0], [0.36, 0.3, 0.07, 0.07, 0], [-0.2, 0.36, 0.14, 0.11, 0],
    [-0.46, 0.44, 0.08, 0.08, 0], [-0.02, -0.7, 0.34, 0.07, -4],
  ];
  // maria = Meere weichgezeichnet und Randverdunklung, beides nur auf der hellen Seite (für den großen Mond)
  function body(cx, cy, r, m, maria) {
    const lit = litPath(cx, cy, r, m), id = `mo-c${++uid}`;
    return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" class="mo-shade"/>
      ${m.k > 0.005 ? `<path d="${lit}" class="mo-lit"/>` : ''}
      ${maria && m.k > 0.005 ? `<defs>
        <clipPath id="${id}"><path d="${lit}"/></clipPath>
        <filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${f(r / 28)}"/></filter>
        <radialGradient id="${id}l"><stop offset=".7" class="mo-limb" style="stop-opacity:0"/><stop offset="1" class="mo-limb" style="stop-opacity:.14"/></radialGradient>
      </defs>
      <g clip-path="url(#${id})">
        <g class="mo-mare" filter="url(#${id}b)">${MARIA.map(([x, y, a, b, rot]) => `<ellipse cx="${f(cx + x * r)}" cy="${f(cy + y * r)}" rx="${f(a * r)}" ry="${f(b * r)}" transform="rotate(${rot} ${f(cx + x * r)} ${f(cy + y * r)})"/>`).join('')}</g>
        <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="url(#${id}l)"/>
      </g>` : ''}
      <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r - 0.5)}" class="mo-edge"/>`;
  }

  // Kleiner Mond für Kalender und Liste; ring = heute
  const glyph = (m, size, ring) => {
    const c = size / 2;
    return `<svg class="mo-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      ${ring ? `<circle cx="${c}" cy="${c}" r="${c - 0.75}" class="mo-ring"/>` : ''}
      ${body(c, c, ring ? c - 3 : c - 1.5, m)}
    </svg>`;
  };

  // Großer Mond am Nachthimmel: Sterne (fest gesetzt), ein Schein, der mit der Beleuchtung wächst, Meere auf der hellen Seite
  function sky(m, W, H) {
    const cx = W / 2, cy = H / 2, r = H / 2 - 16, id = `mo-g${++uid}`;
    let s = 11, stars = '';
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 48; i++) {
      const x = rnd() * W, y = rnd() * H, z = rnd();
      if (Math.hypot(x - cx, y - cy) > r + 24) stars += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.6 + z * 0.8)}" class="mo-star" style="opacity:${(0.16 + z * 0.48).toFixed(2)}"/>`;
    }
    return `<svg class="mo-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <defs><radialGradient id="${id}"><stop offset="${(r / (r + 16)).toFixed(2)}" class="mo-glow" style="stop-opacity:${(0.2 * m.k).toFixed(2)}"/><stop offset="1" class="mo-glow" style="stop-opacity:0"/></radialGradient></defs>
      ${stars}
      <circle cx="${cx}" cy="${cy}" r="${r + 16}" fill="url(#${id})"/>
      ${body(cx, cy, r, m, true)}
    </svg>`;
  }

  const head = (h, title, right) => `
    <div class="row between g-16 mo-head" data-area="text:kopf">
      <p class="t-16 w-500 clip">${h.esc(title)}</p>
      <p class="t-14 ink-2 clip">${right}</p>
    </div>`;

  Factory.register({
    id: 'moon',
    name: 'Mond',
    aliases: ['moon', 'mond', 'mondphase', 'mondphasen', 'mondkalender', 'vollmond', 'neumond', 'lunar', 'nachthimmel'],
    data: {
      title: 'Mond',
      place: 'Hamburg',
      tz: 'Europe/Berlin',
    },
    css: `
      .mo-svg { display: block; overflow: visible; }
      .mo-shade { fill: var(--c-dark-2); }
      .mo-lit { fill: var(--c-highlight); }
      .mo-mare { fill: var(--c-dark); opacity: .09; }
      .mo-limb { stop-color: var(--c-dark); }
      .mo-edge { fill: none; stroke: var(--c-line); }
      &.is-dark .mo-edge { stroke: none; }
      .mo-glow { stop-color: var(--c-highlight); }
      .mo-star { fill: var(--c-on-dark); }
      .mo-ring { fill: none; stroke: var(--c-ink); stroke-width: 1.5; }

      .mo-head > * { min-width: 0; }
      .mo-head > :last-child { flex: none; max-width: 50%; }

      /* Heute: der Mond groß am Nachthimmel, darunter Phase und Beleuchtung */
      .mo-h { display: flex; flex-direction: column; gap: 16px; }
      .mo-sky { height: 208px; }
      .mo-now { margin-top: 8px; display: flex; flex-direction: column; align-items: center; min-width: 0; text-align: center; }
      .mo-now > p { max-width: 100%; }

      /* Kalender: fünf Wochen ab Montag, heute mit Ring, Vergangenes leiser */
      .mo-k { display: flex; flex-direction: column; gap: 16px; }
      .mo-cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: 16px repeat(5, 40px); row-gap: 8px; }
      .mo-wd { text-align: center; }
      .mo-day { display: flex; flex-direction: column; align-items: center; }
      .mo-day.is-past .mo-svg { opacity: .4; }
      .mo-day.is-past p { color: var(--c-ink-3); }
      .mo-day:is(.is-today, .is-first) p { font-weight: 500; }

      /* Phasen: die nächsten vier Hauptphasen, die erste mit kräftiger Frist */
      .mo-p { display: flex; flex-direction: column; gap: 16px; }
      .mo-list { display: flex; flex-direction: column; gap: 8px; }
      .mo-item { height: 48px; display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 16px; align-items: center; }
      .mo-when { display: flex; flex-direction: column; align-items: flex-end; }
      .mo-item.is-next .mo-rel { color: var(--c-ink); font-weight: 500; }
    `,
    layouts: [
      {
        id: 'heute',
        name: 'Heute Nacht',
        idea: 'Das Bild zuerst: der Mond groß und in seiner echten Phase am dunklen Himmel, darunter nur Name, Beleuchtung und der nächste Voll- oder Neumond.',
        height: 368,
        dark: true,
        render: (d, h) => {
          const n = now(d, h), W = h.width - 2 * h.S.inset;
          return `
          <div class="mo-h">
            ${head(h, d.title, h.esc(d.place))}
            <div class="mo-sky" data-area="media:mond" role="img" aria-label="${n.name}, ${n.pct} % beleuchtet">${sky(n.m, W, 208)}</div>
            <div class="mo-now" data-area="text:phase">
              <p class="t-20 w-500 clip">${n.name}</p>
              <p class="t-14 ink-2 clip">${n.pct}&nbsp;% beleuchtet · ${PHASES[n.goal.q]} ${rel(n.goal.days)}</p>
            </div>
          </div>`;
        },
      },
      {
        id: 'kalender',
        name: 'Kalender',
        idea: 'Der Verlauf zuerst: fünf Wochen als Monatsraster, jeder Tag mit seinem Mond, so sieht man Zu- und Abnehmen auf einen Blick.',
        height: 344,
        render: (d, h) => {
          const z = h.zoned(d.tz), t = h.now.getTime();
          const off = Math.round((Date.UTC(z.year, z.month - 1, z.day, z.h, z.m) - t) / 36e5); // Stunden vor UTC
          const start = Date.UTC(z.year, z.month - 1, z.day - (new Date(Date.UTC(z.year, z.month - 1, z.day)).getUTCDay() + 6) % 7);
          const evs = events(start, 28), today = keyOf(t, d.tz);
          const days = Array.from({ length: 35 }, (_, i) => {
            const day = new Date(start + i * DAY), key = day.toISOString().slice(0, 10);
            const ev = evs.find(e => keyOf(e.at, d.tz) === key);
            return { day, key, ev, m: ev ? SHAPE[ev.q] : light(start + i * DAY + (21 - off) * 36e5) };
          });
          const a = days[0].day, b = days[34].day;
          return `
          <div class="mo-k">
            ${head(h, 'Mondkalender', `${a.getUTCDate()}. ${MON[a.getUTCMonth()]} – ${b.getUTCDate()}. ${MON[b.getUTCMonth()]}`)}
            <div class="mo-cal" data-area="media:kalender" role="img" aria-label="Mondphasen vom ${a.getUTCDate()}. ${MON[a.getUTCMonth()]} bis ${b.getUTCDate()}. ${MON[b.getUTCMonth()]}">
              ${WD.map(w => `<p class="t-12 ink-3 mo-wd">${w}</p>`).join('')}
              ${days.map(x => {
                const first = x.day.getUTCDate() === 1, now_ = x.key === today;
                return `<div class="mo-day${x.key < today ? ' is-past' : ''}${now_ ? ' is-today' : ''}${first ? ' is-first' : ''}"${x.ev ? ` title="${PHASES[x.ev.q]}"` : ''}>
                  ${glyph(x.m, 24, now_)}
                  <p class="t-12 num">${first ? MON[x.day.getUTCMonth()] : x.day.getUTCDate()}</p>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        },
      },
      {
        id: 'phasen',
        name: 'Phasen',
        idea: 'Was als Nächstes kommt: die vier nächsten Hauptphasen als Liste mit Tag und Uhrzeit, die nächste mit ihrer Frist hervorgehoben.',
        height: 304,
        render: (d, h) => {
          const n = now(d, h);
          return `
          <div class="mo-p">
            ${head(h, 'Mondphasen', `Mondalter ${n.age} ${n.age === 1 ? 'Tag' : 'Tage'}`)}
            <div class="mo-list" data-area="text:liste">
              ${n.next.slice(0, 4).map((e, i) => `
                <div class="mo-item${i === 0 ? ' is-next' : ''}" data-area="text:phase-${i + 1}">
                  ${glyph(SHAPE[e.q], 40)}
                  <div class="stack">
                    <p class="t-14 tight w-500 clip">${PHASES[e.q]}</p>
                    <p class="t-12 ink-2 clip">${fmt(e.at, d.tz, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  </div>
                  <div class="mo-when">
                    <p class="t-14 tight num">${fmt(e.at, d.tz, { hour: '2-digit', minute: '2-digit' })}</p>
                    <p class="t-12 ink-2 mo-rel">${rel(e.days)}</p>
                  </div>
                </div>`).join('')}
            </div>
          </div>`;
        },
      },
    ],
  });
})();
