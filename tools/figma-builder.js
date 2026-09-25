// Component Factory → Figma. Läuft in figma_execute (Figma-Plugin-API), nicht in Node.
// Einmal ausführen, dann steht globalThis.CF bereit (überlebt zwischen figma_execute-Aufrufen):
//   await CF.buildAtoms(bausteine, { icons })   // zuerst: export/<regelwerk>/_bausteine.figma.json → Section „Bausteine · <Regelwerk>“
//   await CF.build(daten, { page: 'Component Factory', icons: { play: '<component key>' } })
//   await CF.buildFromURL('http://localhost:4173/export/fabrik/music.figma.json')   // falls das Plugin fetch darf
// daten = Inhalt von export/<regelwerk>/<id>.figma.json (node tools/export.mjs figma <id> --system <id>).
// Ergebnis: Seite „Component Factory“ → Section je Regelwerk → Component Set je Komponente, Layouts als Varianten.
// Bausteine (Knöpfe, Umschalter, Chips …) werden in den Karten zu Instanzen der Baustein-Komponenten; Text, Icon,
// Fläche und Schatten kommen als Overrides dazu. Icons: Library (opts.icons) vor dem eigenen Icon-Satz der Section.
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
      const vn = t.name.replace(/^--c-/, 'fabrik/').replace(/^--/, '');
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
  // Ein innerer Ring ohne Weichzeichnung (box-shadow: inset 0 0 0 1.5px) wird in Figma eine Kontur nach innen –
  // als Schatten zeichnet Figma ihn nicht.
  const isRing = s => s.inset && !s.blur && !s.x && !s.y && s.spread > 0;
  const effects = list => (list || []).filter(s => !isRing(s)).map(s => ({ type: s.inset ? 'INNER_SHADOW' : 'DROP_SHADOW', color: { ...rgb(s.color.hex), a: s.color.a }, offset: { x: s.x, y: s.y }, radius: s.blur, spread: s.spread, visible: true, blendMode: 'NORMAL' }));
  function radii(node, r) {
    if (!r) return;
    [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius] = r.map(x => Math.min(x, 1000));
  }

  // Bausteine und eigene Icons dieser Datei (über pluginData gefunden, damit Umbenennen nichts kaputt macht)
  const ATOMS = new Map();       // '<baustein>|<varianten>' → ComponentNode
  const ICONS_LOCAL = new Map(); // '<name>|<größe>' → ComponentNode
  async function loadLibrary(page, systemName) {
    ATOMS.clear(); ICONS_LOCAL.clear();
    const sec = page.children.find(x => x.type === 'SECTION' && x.name === `Bausteine · ${systemName}`);
    if (!sec) return null;
    for (const set of sec.children) {
      if (set.type !== 'COMPONENT_SET') continue;
      const atom = set.getPluginData('cf-atom'), icons = set.getPluginData('cf-icons');
      for (const c of set.children) {
        if (atom) ATOMS.set(`${atom}|${c.getPluginData('cf-vars')}`, c);
        if (icons) ICONS_LOCAL.set(c.getPluginData('cf-icon'), c);
      }
    }
    return sec;
  }
  const paintSig = ps => JSON.stringify((ps === figma.mixed ? [] : ps || []).filter(p => p.visible !== false).map(p => [p.type, p.color ? [p.color.r, p.color.g, p.color.b].map(x => Math.round(x * 255)) : null, Math.round((p.opacity ?? 1) * 100), p.boundVariables?.color?.id || null]));
  function iconPaint(n, V) {
    const m = n.svg && (n.svg.match(/stroke="rgb\(([^)]+)\)"/) || n.svg.match(/fill="rgb\(([^)]+)\)"/));
    if (!m) return null;
    const hex = '#' + m[1].split(/[\s,]+/).map(v => (+v).toString(16).padStart(2, '0')).join('');
    return paint({ hex, a: 1, token: Object.keys(V).find(t => V[t].hex === hex && V[t].a === 1) }, V);
  }
  // Farbe eines Icons sitzt an den Vektoren in der Glyphe
  function recolor(el, p) {
    if (!p) return;
    for (const v of el.findAll(x => x.type === 'VECTOR' || x.type === 'BOOLEAN_OPERATION')) {
      if (v.fills?.length && paintSig(v.fills) !== paintSig([p])) v.fills = [p];
      if (v.strokes?.length && paintSig(v.strokes) !== paintSig([p])) v.strokes = [p];
    }
  }
  // Library-Icon (nächste Größe, nicht skaliert) oder eigenes Icon aus der Bausteine-Section
  async function iconComponent(n, opts) {
    const ref = n.icon && opts.icons && opts.icons[n.icon];
    const key = typeof ref === 'string' ? ref : ref && ref[Object.keys(ref).sort((p, q) => Math.abs(p - n.w) - Math.abs(q - n.w) || q - p)[0]];
    if (key) {
      try { return { comp: await figma.importComponentByKeyAsync(key), lib: true, fixed: typeof ref === 'string' }; }
      catch (e) { log.push(`Icon ${n.icon} nicht importierbar: ${e.message}`); }
    }
    const local = n.icon && ICONS_LOCAL.get(`${n.icon}|${Math.round(n.w)}`);
    if (local) { if (opts.icons) log.push(`Icon ${n.icon}: nicht in der Library, aus dem eigenen Icon-Satz`); return { comp: local }; }
    return null;
  }
  async function styleText(el, n, V) {
    if (el.characters.length) for (const f of el.getRangeAllFontNames(0, el.characters.length)) await figma.loadFontAsync(f);
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
  }

  // Instanz eines Bausteins mit den Inhalten dieser Stelle. Texte und Icons werden in Lesereihenfolge zugeordnet;
  // was der Baustein mehr hat, wird ausgeblendet. Braucht die Stelle mehr, als der Baustein hat: null (dann Frame).
  const leavesData = t => { const out = []; const walk = x => { if (x.type === 'text') out.push({ kind: 'text', n: x }); else if (x.type === 'svg') { if (x.icon) out.push({ kind: 'icon', n: x }); } else (x.children || []).forEach(walk); }; walk(t); return out; };
  const leavesNode = t => { const out = []; const walk = x => { if (x.type === 'TEXT') out.push({ kind: 'text', el: x }); else if (/^Icon\//.test(x.name)) out.push({ kind: 'icon', el: x }); else if ('children' in x) x.children.forEach(walk); }; walk(t); return out; };
  async function atomInstance(comp, n, V, opts) {
    const want = leavesData(n);
    const inst = comp.createInstance();
    const have = leavesNode(inst);
    for (const k of ['text', 'icon']) {
      if (want.filter(x => x.kind === k).length > have.filter(x => x.kind === k).length) {
        inst.remove();
        log.push(`Baustein ${n.atom} „${n.name}“ hat mehr ${k === 'text' ? 'Texte' : 'Icons'} als die Komponente – als Frame gebaut`);
        return null;
      }
    }
    if (Math.abs(inst.width - n.w) > .5 || Math.abs(inst.height - n.h) > .5) inst.resize(Math.max(1, n.w), Math.max(1, n.h));
    const fill = n.fill ? [paint(n.fill, V)] : [];
    if (paintSig(inst.fills) !== paintSig(fill)) inst.fills = fill;
    const eff = effects(n.shadows), sig = list => JSON.stringify(list.map(e => [e.type, Math.round(e.radius), Math.round(e.spread || 0), e.offset && [e.offset.x, e.offset.y]]));
    if (sig(inst.effects) !== sig(eff)) inst.effects = eff;
    for (const k of ['text', 'icon']) {
      const w = want.filter(x => x.kind === k), h = have.filter(x => x.kind === k);
      for (let i = 0; i < h.length; i++) {
        const el = h[i].el;
        if (i >= w.length) { el.visible = false; continue; }
        const d = w[i].n;
        if (k === 'text') {
          const st = d.runs[0]?.style || {};
          const same = el.characters === d.characters && d.runs.length === 1 && el.fontSize === st.size && paintSig(el.fills) === paintSig([paint(st.color, V)]);
          if (!same) await styleText(el, d, V);
        } else {
          const ic = await iconComponent(d, opts);
          if (ic && el.type === 'INSTANCE') { const main = await el.getMainComponentAsync(); if (main?.id !== ic.comp.id) el.swapComponent(ic.comp); }
          recolor(el, iconPaint(d, V));
        }
      }
    }
    return inst;
  }

  const JUSTIFY = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', right: 'MAX', 'space-between': 'SPACE_BETWEEN' };
  const ALIGN = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', baseline: 'BASELINE' };

  async function node(n, V, opts) {
    let el;
    if (n.atom && !opts.noAtoms) {
      const comp = ATOMS.get(`${n.atom}|${(n.vars || []).join(' ')}`);
      if (!comp) log.push(`Baustein ${n.atom}${(n.vars || []).map(v => `.${v}`).join('')} fehlt in Figma – als Frame gebaut (erst CF.buildAtoms)`);
      else if ((el = await atomInstance(comp, n, V, opts))) {
        el.name = n.name || el.name;
        if (n.opacity != null && n.opacity < 1) el.opacity = n.opacity;
        return el;
      }
    }
    if (n.type === 'text') {
      el = figma.createText();
      await styleText(el, n, V);
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
      const ic = n.icon ? await iconComponent(n, opts) : null;
      if (ic) {
        el = ic.comp.createInstance();
        if (ic.fixed) el.resize(n.w, n.h);
        else if (Math.abs(el.width - n.w) > .5) {
          log.push(`Icon ${n.icon}: ${n.w} → ${el.width} px (Größe aus der Library)`);
          n.x += (n.w - el.width) / 2; n.y += (n.h - el.height) / 2;
        }
        recolor(el, iconPaint(n, V));
      } else {
        if (n.icon && opts.icons) log.push(`Icon ${n.icon} fehlt in der Library – als SVG gezeichnet`);
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
      const ring = (n.shadows || []).find(isRing);
      if (ring && !n.stroke) { el.strokes = [paint(ring.color, V)]; el.strokeAlign = 'INSIDE'; el.strokeWeight = ring.spread; }
      if (n.stroke) {
        el.strokes = [paint(n.stroke.color, V)];
        el.strokeAlign = 'INSIDE';
        const [t, r, b, l] = n.stroke.weights;
        if (t === r && r === b && b === l) el.strokeWeight = t;
        else { el.strokeTopWeight = t; el.strokeRightWeight = r; el.strokeBottomWeight = b; el.strokeLeftWeight = l; }
      }
      if (n.shadows?.some(x => !isRing(x))) el.effects = effects(n.shadows);
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
    await loadLibrary(page, data.systemName);
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

  // Komponente an Ort und Stelle neu füllen: Id und Instanzen bleiben, der Inhalt kommt aus dem frisch gebauten Frame
  function refill(comp, frame) {
    for (const k of [...comp.children]) k.remove();
    for (const p of ['layoutMode', 'primaryAxisSizingMode', 'counterAxisSizingMode', 'layoutWrap', 'itemSpacing', 'counterAxisSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'primaryAxisAlignItems', 'counterAxisAlignItems', 'fills', 'strokes', 'strokeWeight', 'strokeAlign', 'effects', 'clipsContent', 'topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius']) {
      try { if (p in frame && JSON.stringify(comp[p]) !== JSON.stringify(frame[p])) comp[p] = frame[p]; } catch (e) { /* passt nicht zu diesem Layout-Modus */ }
    }
    comp.resize(frame.width, frame.height);
    for (const k of [...frame.children]) comp.appendChild(k);
    frame.remove();
  }
  function section(page, name) {
    const sec = figma.createSection();
    sec.name = name;
    sec.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    const others = page.children.filter(x => x !== sec && x.type === 'SECTION');
    sec.x = others.length ? Math.max(...others.map(o => o.x + o.width)) + 200 : 0;
    sec.y = 0;
    return sec;
  }
  // Bausteine und eigener Icon-Satz eines Regelwerks: Section „Bausteine · <Regelwerk>“, ein Component Set je Baustein
  // (Varianten wie in system.js, dazu die Kombinationen, die Komponenten nutzen) und „Icons“ (Glyphe × Größe).
  // Wiederholt ausführbar: vorhandene Komponenten werden neu gefüllt, Instanzen in den Karten bleiben verbunden.
  async function buildAtoms(data, opts = {}) {
    log.length = 0;
    const pageName = opts.page || 'Component Factory';
    let page = figma.root.children.find(p => p.name === pageName);
    if (!page) { page = figma.createPage(); page.name = pageName; }
    await figma.setCurrentPageAsync(page);
    const V = await variables(data);
    const sec = (await loadLibrary(page, data.systemName)) || section(page, `Bausteine · ${data.systemName}`);
    const ink = data.ink ? paint(data.ink, V) : null;
    const iconComps = [];
    for (const ic of data.icons || []) {
      if (opts.icons && opts.icons[ic.name]) continue; // kommt aus der Library
      let frame;
      try { frame = figma.createNodeFromSvg(ic.svg); } catch (e) { log.push(`Icon ${ic.name} nicht lesbar`); continue; }
      recolor(frame, ink);
      const key = `${ic.name}|${ic.size}`;
      let comp = ICONS_LOCAL.get(key);
      if (comp) refill(comp, frame); else comp = figma.createComponentFromNode(frame);
      comp.name = `Glyphe=${ic.name}, Größe=${ic.size}`;
      comp.setPluginData('cf-icon', key);
      ICONS_LOCAL.set(key, comp);
      iconComps.push(comp);
    }
    let iconSet = sec.children.find(x => x.type === 'COMPONENT_SET' && x.getPluginData('cf-icons'));
    const newIcons = iconComps.filter(c => c.parent !== iconSet);
    if (newIcons.length) {
      if (iconSet) newIcons.forEach(c => iconSet.appendChild(c));
      else { iconSet = figma.combineAsVariants(newIcons, sec); iconSet.setPluginData('cf-icons', '1'); }
    }
    const sets = [];
    for (const a of data.atoms || []) {
      const comps = [];
      for (const v of a.sets) {
        const frame = await node(v.tree, V, { ...opts, noAtoms: true });
        const key = `${a.id}|${v.vars.join(' ')}`;
        let comp = ATOMS.get(key);
        if (comp) refill(comp, frame); else comp = figma.createComponentFromNode(frame);
        comp.name = `Variante=${v.label}`;
        comp.setPluginData('cf-vars', v.vars.join(' '));
        comp.description = `${a.match}${v.vars.map(x => `.${x}`).join('')}`;
        ATOMS.set(key, comp);
        comps.push(comp);
      }
      let set = sec.children.find(x => x.type === 'COMPONENT_SET' && x.getPluginData('cf-atom') === a.id);
      const fresh = comps.filter(c => c.parent !== set);
      if (set) fresh.forEach(c => set.appendChild(c));
      else { set = figma.combineAsVariants(comps, sec); set.setPluginData('cf-atom', a.id); }
      set.name = a.name;
      set.description = `${a.use}\nCSS: ${a.match} · Regelwerk ${data.systemName}. Aus der Component Factory (atoms in system.js).`;
      sets.push(set);
    }
    // Alle Sets der Section ordnen, nicht nur die aus diesem Lauf: Bausteine in der Reihenfolge von system.js, Icons zuletzt
    const order = id => { const i = (data.atoms || []).findIndex(a => a.id === id); return i < 0 ? 999 : i; };
    for (const x of sec.children) if (x.type === 'COMPONENT_SET' && x.getPluginData('cf-atom') && !sets.includes(x)) sets.push(x);
    sets.sort((p, q) => order(p.getPluginData('cf-atom')) - order(q.getPluginData('cf-atom')) || p.y - q.y);
    if (iconSet) { iconSet.name = 'Icons'; iconSet.description = `Eigener Icon-Satz der Fabrik (h.icon), je Glyphe und Größe. ${opts.icons ? 'Icons aus der Library (opts.icons) stehen hier nicht.' : ''}`; sets.push(iconSet); }
    let y = 80;
    for (const set of sets) {
      set.layoutMode = 'HORIZONTAL';
      set.counterAxisAlignItems = 'CENTER';
      set.itemSpacing = 24;
      set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 32;
      if (set === iconSet) { set.layoutWrap = 'WRAP'; set.counterAxisSpacing = 24; set.primaryAxisSizingMode = 'FIXED'; set.counterAxisSizingMode = 'AUTO'; set.resize(960, set.height); }
      else { set.primaryAxisSizingMode = 'AUTO'; set.counterAxisSizingMode = 'AUTO'; }
      set.x = 80; set.y = y;
      y += set.height + 48;
    }
    const kids = sec.children;
    sec.resizeWithoutConstraints(Math.max(...kids.map(x => x.x + x.width)) + 80, Math.max(...kids.map(x => x.y + x.height)) + 80);
    return { section: sec.id, atoms: sets.filter(x => x !== iconSet).length, variants: ATOMS.size, icons: ICONS_LOCAL.size, notes: [...new Set(log)] };
  }

  async function buildFromURL(url, opts) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Export nicht geladen: ${res.status}`);
    return build(await res.json(), opts);
  }

  return { build, buildAtoms, buildFromURL, fontFor, log };
})();
'CF bereit';
