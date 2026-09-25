// Component Factory → Figma. Läuft in figma_execute (Figma-Plugin-API), nicht in Node.
// Einmal ausführen, dann steht globalThis.CF bereit (überlebt zwischen figma_execute-Aufrufen):
//   await CF.build(daten, { page: 'Component Factory', icons: { play: '<component key>' } })
//   await CF.buildFromURL('http://localhost:4173/export/zds/music.figma.json')   // falls das Plugin fetch darf
// daten = Inhalt von export/<regelwerk>/<id>.figma.json (node tools/export.mjs figma <id> --system <id>).
// Ergebnis: Seite „Component Factory“ → Section je Regelwerk → Component Set je Komponente, Layouts als Varianten.
globalThis.CF = (() => {
  const rgb = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
  const log = [];

  // Schriften: CSS-Familie + Gewicht → verfügbare Figma-Schrift (ZEIT-Serife heißt dort „Zeit Tiemann“ / „Schmal“)
  let FONTS = null;
  const fontCache = new Map();
  const W = { 100: 'thin', 200: 'extra light', 300: 'light', 400: 'regular', 500: 'medium', 600: 'semi bold', 700: 'bold', 800: 'extra bold', 900: 'black' };
  const normStyle = s => s.toLowerCase().replace(/[-_]/g, ' ').replace('semibold', 'semi bold').replace('extrabold', 'extra bold').replace('demibold', 'semi bold');
  async function fontFor(family, weight = 400, italic = false) {
    const key = `${family}|${weight}|${italic}`;
    if (fontCache.has(key)) return fontCache.get(key);
    FONTS ||= await figma.listAvailableFontsAsync();
    const fam = /tiemann/i.test(family || '') ? { name: 'Zeit Tiemann', prefer: 'schmal' } : { name: family || 'Inter', prefer: null };
    let pool = FONTS.filter(f => f.fontName.family.toLowerCase() === fam.name.toLowerCase());
    if (!pool.length) { log.push(`Schrift „${family}“ fehlt in Figma – Inter als Ersatz`); pool = FONTS.filter(f => f.fontName.family === 'Inter'); }
    const want = W[Math.round(weight / 100) * 100] || 'regular';
    let best = pool[0].fontName, score = -1;
    for (const f of pool) {
      const st = normStyle(f.fontName.style);
      let s = 0;
      if (fam.prefer && st.includes(fam.prefer)) s += 20;
      if (st === want || st.startsWith(want + ' ') || (want === 'regular' && /^(regular|roman|book|normal)$/.test(st))) s += 8;
      else if (st.includes(want)) s += 5;
      if (italic === /italic|oblique/.test(st)) s += 3;
      if (s > score) { best = f.fontName; score = s; }
    }
    await figma.loadFontAsync(best);
    fontCache.set(key, best);
    return best;
  }

  // Farb-Tokens als lokale Variablen „Component Factory · <Regelwerk>“; Füllungen werden daran gebunden
  async function variables(data) {
    const name = `Component Factory · ${data.systemName}`;
    let col = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === name);
    if (!col) col = figma.variables.createVariableCollection(name);
    const mode = col.modes[0].modeId;
    const all = await figma.variables.getLocalVariablesAsync('COLOR');
    const map = {};
    for (const t of data.tokens) {
      const vn = t.name.replace(/^--c-/, 'fabrik/').replace(/^--z-ds-color-/, 'zds/').replace(/^--/, '');
      let v = all.find(x => x.variableCollectionId === col.id && x.name === vn);
      if (!v) v = figma.variables.createVariable(vn, col, 'COLOR');
      v.setValueForMode(mode, { ...rgb(t.hex), a: t.a });
      map[t.name] = { v, a: t.a, hex: t.hex.toLowerCase() };
    }
    return map;
  }
  function paint(c, V) {
    if (!c) return null;
    const tok = c.token && V[c.token];
    // Farbe deckender als der Token? Dann nicht binden – Deckkraft über 100 % geht nicht.
    if (!tok || c.a > tok.a + .01) return { type: 'SOLID', color: rgb(c.hex), opacity: c.a };
    const p = { type: 'SOLID', color: rgb(c.hex), opacity: tok.a ? Math.min(1, c.a / tok.a) : c.a };
    return figma.variables.setBoundVariableForPaint(p, 'color', tok.v);
  }
  // CSS linear-gradient(…) → Figma-Verlauf (einfacher Winkel, Farbstopps)
  function gradient(css) {
    const m = css.match(/linear-gradient\((.*)\)$/);
    if (!m) return null;
    const parts = m[1].split(/,(?![^(]*\))/).map(s => s.trim());
    let deg = 180;
    if (/deg$/.test(parts[0])) deg = parseFloat(parts.shift());
    else if (/^to /.test(parts[0])) deg = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 }[parts.shift()] ?? 180;
    const stops = parts.map((p, i) => {
      const col = p.match(/rgba?\(([^)]+)\)/);
      if (!col) return null;
      const v = col[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      const pos = p.match(/(-?[\d.]+)%/);
      return { color: { r: v[0] / 255, g: v[1] / 255, b: v[2] / 255, a: v.length > 3 ? v[3] : 1 }, position: pos ? parseFloat(pos[1]) / 100 : i / Math.max(1, parts.length - 1) };
    }).filter(Boolean);
    if (stops.length < 2) return null;
    const a = (deg - 90) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    return { type: 'GRADIENT_LINEAR', gradientStops: stops, gradientTransform: [[cos, sin, 0.5 - cos / 2 - sin / 2], [-sin, cos, 0.5 + sin / 2 - cos / 2]] };
  }
  const effects = list => (list || []).map(s => ({ type: s.inset ? 'INNER_SHADOW' : 'DROP_SHADOW', color: { ...rgb(s.color.hex), a: s.color.a }, offset: { x: s.x, y: s.y }, radius: s.blur, spread: s.spread, visible: true, blendMode: 'NORMAL' }));
  function radii(node, r) {
    if (!r) return;
    [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius] = r.map(x => Math.min(x, 1000));
  }

  const JUSTIFY = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', right: 'MAX', 'space-between': 'SPACE_BETWEEN' };
  const ALIGN = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', baseline: 'BASELINE' };

  async function node(n, V, opts) {
    let el;
    if (n.type === 'text') {
      el = figma.createText();
      const s0 = n.runs[0]?.style || {};
      el.fontName = await fontFor(s0.family, s0.weight, s0.italic);
      el.characters = n.characters || ' ';
      for (const r of n.runs) {
        const st = r.style;
        el.setRangeFontName(r.start, r.end, await fontFor(st.family, st.weight, st.italic));
        el.setRangeFontSize(r.start, r.end, st.size);
        if (st.lh) el.setRangeLineHeight(r.start, r.end, { value: st.lh, unit: 'PIXELS' });
        if (st.ls) el.setRangeLetterSpacing(r.start, r.end, { value: st.ls, unit: 'PIXELS' });
        const p = paint(st.color, V);
        if (p) el.setRangeFills(r.start, r.end, [p]);
        if (st.strike) el.setRangeTextDecoration(r.start, r.end, 'STRIKETHROUGH');
      }
      el.textAlignHorizontal = { center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' }[n.align] || 'LEFT';
      el.resize(Math.max(1, n.w), Math.max(1, n.h));
      if (n.truncate || n.clamp) {
        // Reihenfolge zählt: textAutoResize = 'NONE' nach der Kürzung schaltet sie wieder aus.
        // Figma setzt etwas breiter als der Browser; passt der Text knapp nicht, bekommt er die paar px dazu statt „Mira L…“.
        el.textAutoResize = 'WIDTH_AND_HEIGHT';
        const natural = el.width;
        el.textAutoResize = 'NONE';
        const w = !n.clamp && natural > n.w && natural <= n.w * 1.1 + 2 ? Math.ceil(natural) : n.w;
        el.resize(Math.max(1, w), Math.max(1, n.h));
        el.textTruncation = 'ENDING';
        if (n.clamp > 1) el.maxLines = n.clamp;
      }
      else {
        // Einzeilige Texte wachsen mit dem Inhalt: Figma misst etwas breiter als der Browser und bräche sonst um.
        const lh = Math.max(...n.runs.map(r => r.style.lh || r.style.size * 1.2));
        el.textAutoResize = n.nowrap || (!n.grow && n.h <= lh + 1) ? 'WIDTH_AND_HEIGHT' : 'HEIGHT';
      }
    } else if (n.type === 'svg') {
      // opts.icons[name] = Komponenten-Key oder { 14: key, 18: key, 24: key } – dann die nächste Größe, nicht skaliert
      const ref = n.icon && opts.icons && opts.icons[n.icon];
      const key = typeof ref === 'string' ? ref : ref && ref[Object.keys(ref).sort((p, q) => Math.abs(p - n.w) - Math.abs(q - n.w))[0]];
      if (key) {
        try {
          el = (await figma.importComponentByKeyAsync(key)).createInstance();
          if (typeof ref === 'string') el.resize(n.w, n.h);
          else if (Math.abs(el.width - n.w) > .5) {
            log.push(`Icon ${n.icon}: ${n.w} → ${el.width} px (Größe aus der Library)`);
            n.x += (n.w - el.width) / 2; n.y += (n.h - el.height) / 2;
          }
          // Farbe wie im Code: sitzt an den Vektoren in der Glyphe
          const m = n.svg && (n.svg.match(/stroke="rgb\(([^)]+)\)"/) || n.svg.match(/fill="rgb\(([^)]+)\)"/));
          if (m) {
            const hex = '#' + m[1].split(/[\s,]+/).map(v => (+v).toString(16).padStart(2, '0')).join('');
            const token = Object.keys(V).find(t => V[t].hex === hex && V[t].a === 1);
            const p = paint({ hex, a: 1, token }, V);
            for (const v of el.findAll(x => x.type === 'VECTOR' || x.type === 'BOOLEAN_OPERATION')) {
              if (v.fills?.length) v.fills = [p];
              if (v.strokes?.length) v.strokes = [p];
            }
          }
        } catch (e) { el = null; log.push(`Icon ${n.icon} nicht importierbar: ${e.message}`); }
      } else if (n.icon && opts.icons) log.push(`Icon ${n.icon} fehlt in der Library – als SVG gezeichnet`);
      if (!el) {
        try { el = figma.createNodeFromSvg(n.svg); }
        catch (e) { el = figma.createFrame(); el.fills = []; log.push(`SVG nicht lesbar (${n.name})`); }
        if (Math.abs(el.width - n.w) > .5 || Math.abs(el.height - n.h) > .5) el.resize(Math.max(1, n.w), Math.max(1, n.h));
      }
    } else if (n.type === 'media') {
      el = figma.createRectangle();
      el.resize(Math.max(1, n.w), Math.max(1, n.h));
      radii(el, n.radius);
      el.fills = [n.fill ? { type: 'SOLID', color: rgb(n.fill.hex), opacity: n.fill.a } : { type: 'SOLID', color: { r: .93, g: .93, b: .93 } }];
      if (n.img && /^https?:/.test(n.img) && opts.images !== false) {
        try { const img = await figma.createImageAsync(n.img); el.fills = [{ type: 'IMAGE', imageHash: img.hash, scaleMode: 'FILL' }]; } catch (e) { /* Platzhalterfarbe bleibt */ }
      }
    } else {
      el = figma.createFrame();
      const fills = [];
      if (n.fill) fills.push(paint(n.fill, V));
      const g = n.gradient && gradient(n.gradient);
      if (g) fills.push(g);
      el.fills = fills;
      el.resize(Math.max(1, n.w), Math.max(1, n.h));
      radii(el, n.radius);
      if (n.stroke) {
        el.strokes = [paint(n.stroke.color, V)];
        el.strokeAlign = 'INSIDE';
        const [t, r, b, l] = n.stroke.weights;
        if (t === r && r === b && b === l) el.strokeWeight = t;
        else { el.strokeTopWeight = t; el.strokeRightWeight = r; el.strokeBottomWeight = b; el.strokeLeftWeight = l; }
      }
      if (n.shadows?.length) el.effects = effects(n.shadows);
      el.clipsContent = !!n.clip;
      if (n.layout) {
        el.layoutMode = n.layout.dir === 'V' ? 'VERTICAL' : 'HORIZONTAL';
        el.primaryAxisSizingMode = 'FIXED';
        el.counterAxisSizingMode = 'FIXED';
        el.itemSpacing = n.layout.gap || 0;
        if (n.layout.wrap) { el.layoutWrap = 'WRAP'; el.counterAxisSpacing = n.layout.crossGap || 0; }
        [el.paddingTop, el.paddingRight, el.paddingBottom, el.paddingLeft] = n.pad || [0, 0, 0, 0];
        el.primaryAxisAlignItems = JUSTIFY[n.layout.justify] || 'MIN';
        el.counterAxisAlignItems = ALIGN[n.layout.align] || 'MIN';
        el.resize(Math.max(1, n.w), Math.max(1, n.h));
      }
      for (const k of n.children || []) {
        const kid = await node(k, V, opts);
        el.appendChild(kid);
        if (n.layout && !k.abs) {
          const stretch = k.alignSelf === 'stretch' || ((!k.alignSelf || /^(auto|normal)$/.test(k.alignSelf)) && /^(normal|stretch)$/.test(n.layout.align));
          if ('layoutGrow' in kid) kid.layoutGrow = k.grow ? 1 : 0;
          if ('layoutAlign' in kid) kid.layoutAlign = stretch ? 'STRETCH' : 'INHERIT';
        } else {
          if (n.layout) kid.layoutPositioning = 'ABSOLUTE';
          kid.x = k.x - n.x;
          kid.y = k.y - n.y;
        }
      }
    }
    el.name = n.icon ? `Icon/${n.icon}` : n.name || el.name;
    if (n.opacity != null && n.opacity < 1) el.opacity = n.opacity;
    return el;
  }

  async function build(data, opts = {}) {
    log.length = 0;
    const pageName = opts.page || 'Component Factory';
    let page = figma.root.children.find(p => p.name === pageName);
    if (!page) { page = figma.createPage(); page.name = pageName; }
    await figma.setCurrentPageAsync(page);
    const V = await variables(data);
    const comps = [];
    for (const l of data.layouts) {
      const frame = await node(l.tree, V, opts);
      frame.name = `Layout=${l.name}`;
      const comp = figma.createComponentFromNode(frame);
      comp.description = [l.idea, l.variantOf ? `Variante von ${l.variantOf}` : '', l.family ? `Familie: ${l.family}` : ''].filter(Boolean).join('\n');
      comps.push(comp);
    }
    // Section je Regelwerk, hell (eine leere Section ist dunkelgrau)
    let sec = page.children.find(x => x.type === 'SECTION' && x.name === data.systemName);
    if (!sec) {
      sec = figma.createSection();
      sec.name = data.systemName;
      sec.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      const others = page.children.filter(x => x !== sec && x.type === 'SECTION');
      sec.x = others.length ? Math.max(...others.map(o => o.x + o.width)) + 200 : 0;
      sec.y = 0;
    }
    const old = sec.children.find(x => x.type === 'COMPONENT_SET' && x.name === data.component.name);
    let pos = null;
    if (old) { pos = { x: old.x, y: old.y }; old.remove(); }
    const set = figma.combineAsVariants(comps, sec);
    set.name = data.component.name;
    set.description = `Aus der Component Factory, Regelwerk ${data.systemName}, ${data.created.slice(0, 10)}. Komponente components/${data.component.id}.js.`;
    set.layoutMode = 'HORIZONTAL';
    set.primaryAxisSizingMode = 'AUTO';
    set.counterAxisSizingMode = 'AUTO';
    set.counterAxisAlignItems = 'MIN';
    set.itemSpacing = 40;
    set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 40;
    if (pos) { set.x = pos.x; set.y = pos.y; }
    else {
      const rest = sec.children.filter(x => x !== set);
      set.x = 80;
      set.y = rest.length ? Math.max(...rest.map(x => x.y + x.height)) + 80 : 80;
    }
    const kids = sec.children;
    sec.resizeWithoutConstraints(Math.max(...kids.map(x => x.x + x.width)) + 80, Math.max(...kids.map(x => x.y + x.height)) + 80);
    return { set: set.id, name: set.name, variants: comps.length, section: sec.id, page: page.id, notes: [...new Set(log)] };
  }

  async function buildFromURL(url, opts) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Export nicht geladen: ${res.status}`);
    return build(await res.json(), opts);
  }

  return { build, buildFromURL, fontFor, log };
})();
'CF bereit';
