/* =========================================================================
   Banco de Puntos: núcleo compartido
   Lo usan asistencia/, informes/ y mis-puntos/.
   El formato de la tarjeta, la firma y las listas de colores y emojis
   deben coincidir EXACTAMENTE con index.html. Si cambias uno, cambia ambos.
   ========================================================================= */
'use strict';
const BP = (() => {
  // Raíz del repositorio (donde está nucleo.js), sin importar desde qué carpeta se cargue.
  const RAIZ = new URL('.', (document.currentScript && document.currentScript.src) || location.href).href;
  /* ---------- Utilidades ---------- */
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('es-CO');
  const pct = n => (Number.isFinite(n) ? Math.round(n * 100) : 0) + ' %';
  const clon = o => JSON.parse(JSON.stringify(o));
  const te = new TextEncoder(), td = new TextDecoder();
  const b64e = u => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64d = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  const iguales = (a, b) => !!a && !!b && a.length === b.length && Array.from(a).every((x, i) => x === b[i]);
  const EPOCH = Date.UTC(2024, 0, 1);
  const hoyDia = () => { const d = new Date(); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5); };
  const fechaDia = n => new Date(EPOCH + n * 864e5).toLocaleDateString('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const isoDia = n => new Date(EPOCH + n * 864e5).toISOString().slice(0, 10);
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const cuando = iso => { try { return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
  const fechaCorta = iso => { try { return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }); } catch (e) { return iso; } };
  const iniciales = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const vibrar = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  /* ---------- Datos del Banco (compartidos en este navegador) ---------- */
  const KEY_BANCO = 'bancoPuntos.v2', KEY_CAT = 'bancoPuntos.catalogo';
  const CFG_BASE = {
    docente: '', codigoDocente: 1, pinDocente: null, pinAlAbrir: false, pinCadaMov: false, pinEstudiantes: false,
    tope: 0, confirmarDesde: 100, deshacer: true, verificar: false, listaCurso: false, canjes: false,
    recordatorio: true, ultimoRespaldo: 0, periodo: 1, reglaCierre: 'conservar', porcentaje: 50,
    reglaColor: 'curso', colorUnico: 1, emojis: true, usarInstitucional: true, misCursos: []
  };
  function leerBanco() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY_BANCO));
      if (!d || !d.students) return null;
      d.movs = d.movs || []; d.cfg = Object.assign({}, CFG_BASE, d.cfg || {});
      Object.values(d.students).forEach(s => { if (s.t && !Array.isArray(s.t.cuentas)) s.t.cuentas = s.t.saldo > 0 ? [{ c: 0, s: s.t.saldo }] : []; });
      return d;
    } catch (e) { return null; }
  }
  const guardarBanco = d => localStorage.setItem(KEY_BANCO, JSON.stringify(d));
  const activos = db => Object.values(db?.students || {}).filter(s => s.estado !== 'bloqueada' && s.t);
  const cursosDe = db => [...new Set([...(db?.cfg?.misCursos || []), ...activos(db).map(s => s.t.curso).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

  /* ---------- Catálogo ---------- */
  const CAT_BASE = { version: 0, nombreInstitucional: 'Institucional', motivos: [{ codigo: 'AS', nombre: 'Asistencia', tipo: 'dar' }, { codigo: 'OT', nombre: 'Otro', tipo: 'ambos' }], canjes: [], docentes: [] };
  function validarCat(c) {
    const cod = x => /^[A-Z0-9]{2}$/.test(x.codigo || '');
    return !!c && Array.isArray(c.motivos) && c.motivos.length > 0 && c.motivos.every(m => cod(m) && m.nombre)
      && (!c.canjes || (Array.isArray(c.canjes) && c.canjes.every(x => cod(x) && x.nombre && x.precio > 0)));
  }
  let cat = (() => { try { const c = JSON.parse(localStorage.getItem(KEY_CAT)); if (validarCat(c)) return c; } catch (e) {} return CAT_BASE; })();
  async function actualizarCatalogo() {
    try {
      const r = await fetch(new URL('catalogo.json', RAIZ), { cache: 'no-cache' }); if (!r.ok) return false;
      const j = await r.json(); if (!validarCat(j)) return false;
      cat = j; localStorage.setItem(KEY_CAT, JSON.stringify(j)); return true;
    } catch (e) { return false; }
  }
  const SIS = { apertura: 'Registro de tarjeta', restauracion: 'Saldo restaurado', cierre: 'Cierre de periodo', traslado: 'Cambio de tarjeta' };
  function nombreMotivo(tipo, codigo) {
    if (SIS[tipo]) return SIS[tipo];
    const base = (cat.canjes || []).find(x => x.codigo === codigo)?.nombre || cat.motivos.find(m => m.codigo === codigo)?.nombre
      || (tipo === 'dar' ? 'Puntos recibidos' : tipo === 'cobrar' ? 'Cobro' : codigo);
    return tipo === 'deshacer' ? 'Se deshizo: ' + base : tipo === 'canje' ? 'Canje: ' + base : base;
  }
  const nombreDocente = n => (cat.docentes || []).find(d => d.codigo === n)?.nombre || (n ? 'Docente ' + n : '');
  const nombreCuenta = (c, cfg) => c === 0 ? (cat.nombreInstitucional || 'Institucional')
    : (cfg && c === cfg.codigoDocente && cfg.docente && !(cat.docentes || []).some(d => d.codigo === c) ? cfg.docente : nombreDocente(c));

  /* ---------- Apariencia (mismas listas que index.html) ---------- */
  const PALETA = [null,
    { n: 'Amarillo', bg: '#ffc93c', ink: '#14213d' }, { n: 'Naranja', bg: '#ff8c42', ink: '#2a1300' },
    { n: 'Coral', bg: '#ff6b6b', ink: '#2a0808' }, { n: 'Rosa', bg: '#f78fb3', ink: '#2b0a17' },
    { n: 'Lavanda', bg: '#b197fc', ink: '#160b3a' }, { n: 'Azul', bg: '#4dabf7', ink: '#08223a' },
    { n: 'Turquesa', bg: '#3bc9db', ink: '#062a30' }, { n: 'Verde', bg: '#69db7c', ink: '#0b2e13' },
    { n: 'Lima', bg: '#c0eb75', ink: '#1f2a05' }, { n: 'Marino', bg: '#14213d', ink: '#ffc93c' },
    { n: 'Grafito', bg: '#343a40', ink: '#f8f9fa' }, { n: 'Vino', bg: '#862e5c', ink: '#fff0f6' }];
  const EMOJIS = ['', '⭐', '🚀', '⚽', '🏀', '🎸', '🎨', '📚', '🔬', '🧪', '💡', '🎮', '🎧', '🌱', '🌻', '🌙', '☀️', '🔥', '⚡', '🌈',
    '🐱', '🐶', '🦊', '🐼', '🦁', '🐸', '🐢', '🦋', '🐬', '🦉', '🐉', '🍀', '🎯', '🏆', '🧩', '🎲', '🛹', '🚲', '📷', '🌎'];
  function colorCurso(curso) {
    const c = (curso || '').toUpperCase().replace(/\s+/g, ''); if (!c) return 1;
    let h = 0; for (const ch of c) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return 1 + (h % (PALETA.length - 1));
  }
  const temaDe = t => PALETA[(t.color > 0 && t.color < PALETA.length) ? t.color : colorCurso(t.curso)];
  const emojiDe = t => EMOJIS[t.emoji] || '';
  const estilo = t => { const p = temaDe(t); return `--tc-bg:${p.bg};--tc-ink:${p.ink}`; };
  function normalizarTema(t, cfg) {
    if (cfg.reglaColor === 'curso') t.color = 0;
    else if (cfg.reglaColor === 'unico') t.color = cfg.colorUnico || 1;
    if (!cfg.emojis) t.emoji = 0;
  }

  /* ---------- Formato de la tarjeta (versión 4; lee 2 y 3) ---------- */
  const TIPOS = ['dar', 'cobrar', 'apertura', 'restauracion', 'deshacer', 'canje', 'cierre', 'traslado'];
  const MAX_MOVS = 5, MAX_CUENTAS = 8;
  function recorte(s, max) { s = (s || '').trim(); let b = te.encode(s); while (b.length > max) { s = [...s].slice(0, -1).join(''); b = te.encode(s); } return b; }
  const set24 = (v, o, n) => { n = Math.max(0, Math.min(16777215, Math.round(n || 0))); v.setUint8(o, n >> 16); v.setUint16(o + 1, n & 0xffff); };
  const get24 = (v, o) => (v.getUint8(o) << 16) | v.getUint16(o + 1);
  const recalcular = t => { t.cuentas = t.cuentas || []; t.saldo = t.cuentas.reduce((a, x) => a + x.s, 0); return t; };
  const saldoCuenta = (t, c) => ((t.cuentas || []).find(x => x.c === c) || { s: 0 }).s;
  function cuentaDe(t, c) {
    let x = t.cuentas.find(y => y.c === c);
    if (!x) {
      const vacias = t.cuentas.filter(y => y.s === 0 && y.c !== 0);
      if (t.cuentas.length - vacias.length >= MAX_CUENTAS) throw new Error('La tarjeta ya tiene 8 cuentas con saldo.');
      x = { c, s: 0 }; t.cuentas.push(x); t.cuentas.sort((a, b) => a.c - b.c);
    }
    return x;
  }
  function codificar(t) {
    const nom = recorte(t.nombre, 24), cur = recorte(t.curso, 8), movs = t.movs.slice(-MAX_MOVS);
    const cts = (t.cuentas || []).filter(x => x.s > 0).slice(0, MAX_CUENTAS);
    const b = new Uint8Array(20 + cts.length * 4 + movs.length * 8 + 2 + nom.length + cur.length), v = new DataView(b.buffer);
    b[0] = 4; v.setUint16(1, t.contador & 0xffff); set24(v, 3, t.ganado); set24(v, 6, t.gastado);
    v.setUint16(9, Math.max(0, t.registro)); b[11] = Math.min(255, t.periodo || 1);
    if (t.pin) b.set(t.pin, 12);
    b[16] = t.color || 0; b[17] = t.emoji || 0; b[18] = cts.length; b[19] = movs.length;
    let o = 20;
    for (const x of cts) { b[o] = x.c; set24(v, o + 1, x.s); o += 4; }
    for (const m of movs) {
      const cod = ((m.codigo || '--') + '--').slice(0, 2);
      v.setUint16(o, Math.max(0, m.dia));
      b[o + 2] = Math.max(0, TIPOS.indexOf(m.tipo)) | (m.puntos < 0 ? 0x80 : 0) | (m.cuenta === 0 ? 0x40 : 0);
      b[o + 3] = cod.charCodeAt(0); b[o + 4] = cod.charCodeAt(1);
      v.setUint16(o + 5, Math.min(65535, Math.abs(m.puntos))); b[o + 7] = m.docente || 0; o += 8;
    }
    b[o++] = nom.length; b.set(nom, o); o += nom.length; b[o++] = cur.length; b.set(cur, o);
    return b;
  }
  function decodificar(b) {
    try {
      const ver = b[0];
      if (b.length < 22 || ![2, 3, 4].includes(ver)) return null;
      const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
      let t, o, n;
      if (ver === 4) {
        t = { contador: v.getUint16(1), ganado: get24(v, 3), gastado: get24(v, 6), registro: v.getUint16(9), periodo: b[11], pin: null, color: b[16], emoji: b[17], cuentas: [], movs: [] };
        const pin = Array.from(b.slice(12, 16)); if (pin.some(x => x)) t.pin = pin;
        const nc = b[18]; n = b[19]; if (nc > MAX_CUENTAS || n > MAX_MOVS) return null;
        o = 20;
        for (let i = 0; i < nc; i++) { t.cuentas.push({ c: b[o], s: get24(v, o + 1) }); o += 4; }
      } else {
        const saldo = get24(v, 1);
        t = { contador: v.getUint16(4), ganado: get24(v, 6), gastado: get24(v, 9), registro: v.getUint16(12), periodo: b[14], pin: null, color: 0, emoji: 0, cuentas: saldo > 0 ? [{ c: 0, s: saldo }] : [], movs: [] };
        const pin = Array.from(b.slice(15, 19)); if (pin.some(x => x)) t.pin = pin;
        n = b[19]; if (n > MAX_MOVS) return null;
        o = 20; if (ver === 3) { t.color = b[20]; t.emoji = b[21]; o = 22; }
      }
      for (let i = 0; i < n; i++) {
        const tb = b[o + 2], doc = b[o + 7], puntos = (tb & 0x80 ? -1 : 1) * v.getUint16(o + 5);
        const inst = ver < 4 || (tb & 0x40);
        t.movs.push({ dia: v.getUint16(o), tipo: TIPOS[tb & 0x3f] || 'dar', puntos, codigo: String.fromCharCode(b[o + 3], b[o + 4]), docente: doc, cuenta: inst ? 0 : doc });
        o += 8;
      }
      const ln = b[o++]; t.nombre = td.decode(b.slice(o, o + ln)); o += ln;
      const lc = b[o++]; t.curso = td.decode(b.slice(o, o + lc)); o += lc;
      return o === b.length ? recalcular(t) : null;
    } catch (e) { return null; }
  }
  function aplicarMov(t, tipo, puntos, codigo, cuenta, docente) {
    if (puntos) { const x = cuentaDe(t, cuenta); x.s = Math.max(0, x.s + puntos); }
    recalcular(t); t.contador++;
    if (tipo === 'dar' || tipo === 'apertura') t.ganado += puntos;
    else if (tipo === 'cobrar' || tipo === 'canje') t.gastado -= puntos;
    t.ganado = Math.max(0, t.ganado); t.gastado = Math.max(0, t.gastado);
    t.movs.push({ dia: hoyDia(), tipo, puntos, codigo: codigo || '--', docente: docente || 0, cuenta: puntos ? cuenta : 0 });
    t.movs = t.movs.slice(-MAX_MOVS);
  }
  // Asistencia: si el último movimiento de la tarjeta es la misma asistencia, se suma a él en vez de ocupar otro espacio.
  function aplicarAsistencia(t, puntos, codigo, cuenta, docente) {
    const u = t.movs[t.movs.length - 1];
    if (u && u.tipo === 'dar' && u.codigo === codigo && u.cuenta === cuenta && u.docente === docente && u.puntos + puntos <= 65535) {
      const x = cuentaDe(t, cuenta); x.s += puntos; recalcular(t); t.contador++; t.ganado += puntos;
      u.puntos += puntos; u.dia = hoyDia();
    } else aplicarMov(t, 'dar', puntos, codigo, cuenta, docente);
  }
  function aplicarCierre(t, cfg) {
    const f = x => cfg.reglaCierre === 'reiniciar' ? 0 : cfg.reglaCierre === 'porcentaje' ? Math.floor(x * Math.min(100, cfg.porcentaje) / 100) : x;
    const antes = t.saldo;
    t.cuentas.forEach(x => x.s = f(x.s)); t.cuentas = t.cuentas.filter(x => x.s > 0);
    recalcular(t); t.periodo = cfg.periodo; t.contador++;
    t.movs.push({ dia: hoyDia(), tipo: 'cierre', puntos: t.saldo - antes, codigo: '--', docente: cfg.codigoDocente || 0, cuenta: 0 });
    t.movs = t.movs.slice(-MAX_MOVS);
    return t.saldo - antes;
  }
  function movLocal(uid, t, tipo, puntos, codigo, obs, cuenta, cfg) {
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), uid, nombre: t.nombre, curso: t.curso,
      tipo, puntos, codigo: codigo || '--', motivo: nombreMotivo(tipo, codigo), observacion: obs || '', cuenta, cuenta_nombre: nombreCuenta(cuenta, cfg), saldo_cuenta: saldoCuenta(t, cuenta),
      saldo: t.saldo, contador: t.contador, docente: cfg.docente || nombreDocente(cfg.codigoDocente), periodo: t.periodo };
  }

  /* ---------- Firmas ---------- */
  let llave = { clave: null, key: null };
  async function hmac(clave, bytes) {
    if (llave.clave !== clave) llave = { clave, key: await crypto.subtle.importKey('raw', te.encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']) };
    return new Uint8Array(await crypto.subtle.sign('HMAC', llave.key, bytes));
  }
  async function firmaTarjeta(clave, uid, payload) { const u = te.encode(uid), m = new Uint8Array(u.length + payload.length); m.set(u); m.set(payload, u.length); return (await hmac(clave, m)).slice(0, 12); }
  async function sha(s) { return b64e(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s)))); }

  /* ---------- Enlaces de la tarjeta ---------- */
  function urlTarjeta(payload, sig) {
    const all = new Uint8Array(payload.length + 12); all.set(payload); if (sig) all.set(sig, payload.length);
    const u = new URL('saldo.html', RAIZ); u.search = ''; u.hash = 'd=' + b64e(all); return u.href;
  }
  // Enlace armado desde el registro (sin firma: sirve para ver, nunca para validar).
  const urlDesdeRegistro = t => urlTarjeta(codificar(t), null);
  function leerTexto(txt) {
    const m = (txt || '').match(/#d=([A-Za-z0-9_-]+)/); if (!m) return null;
    try { const all = b64d(m[1]); if (all.length < 34) return { t: null }; const payload = all.slice(0, -12); return { payload, sig: all.slice(-12), t: decodificar(payload) }; }
    catch (e) { return { t: null }; }
  }
  function leerNFC(e) {
    const uid = (e.serialNumber || '').toUpperCase(); let p = null;
    try { for (const r of e.message.records) { if (r.recordType !== 'url' && r.recordType !== 'absolute-url') continue; const x = leerTexto(td.decode(r.data)); if (x) p = x; } } catch (_) { p = p || { t: null }; }
    return { uid, p };
  }
  async function evaluar(db, uid, p) {
    const s = db.students[uid] || null;
    if (s && s.estado === 'bloqueada') return { uid, estado: 'bloqueada', s };
    if (!p) return { uid, estado: s ? 'vacia' : 'nueva', s };
    if (!p.t) return { uid, estado: 'alterada', s, t: null };
    if (!iguales(await firmaTarjeta(db.clave, uid, p.payload), p.sig)) return { uid, estado: 'alterada', s, t: p.t };
    if (s && p.t.contador < s.t.contador) return { uid, estado: 'antigua', s, t: p.t };
    return { uid, estado: 'ok', s, t: p.t, p };
  }
  // Igual que en index.html: sincroniza el registro con la tarjeta y prepara el cierre de periodo.
  function prepararT(db, ev) {
    const cfg = db.cfg; let sync = '', s = db.students[ev.uid];
    if (!s) { s = db.students[ev.uid] = { uid: ev.uid, t: clon(ev.t), estado: 'activa', anteriores: [] }; sync = 'nuevo'; }
    else if (ev.t.contador > s.t.contador || (ev.t.contador === s.t.contador && ev.t.saldo !== s.t.saldo)) {
      const n = s.t.nombre, c = s.t.curso, igual = ev.t.contador === s.t.contador;
      s.t = clon(ev.t); if (igual) { s.t.nombre = n; s.t.curso = c; } sync = 'actualizado';
    }
    const t = clon(ev.t), movs = [];
    if (s.t.contador === t.contador) { t.nombre = s.t.nombre; t.curso = s.t.curso; }
    if (t.periodo > cfg.periodo) cfg.periodo = t.periodo;
    else if (t.periodo < cfg.periodo) { const d = aplicarCierre(t, cfg); movs.push(movLocal(ev.uid, t, 'cierre', d, '--', '', 0, cfg)); }
    return { t, movs, sync };
  }

  /* ---------- NFC ---------- */
  const NFC = 'NDEFReader' in window;
  let lector = null;
  async function activarLector(onLeer) {
    if (!NFC) return false;
    if (lector) return true;
    try {
      const r = new NDEFReader();
      r.addEventListener('reading', onLeer);
      r.addEventListener('readingerror', () => { vibrar([60, 50, 60]); cubierta('No se alcanzó a leer', 'Acerca la tarjeta otra vez y déjala quieta hasta la vibración larga.', 'aviso-lectura', 2600); });
      await r.scan(); lector = r; return true;
    } catch (e) {
      toast(e.name === 'NotAllowedError' ? 'Permiso de NFC denegado. Actívalo en los ajustes del sitio en Chrome.' : e.name === 'NotReadableError' ? 'Enciende el NFC del teléfono.' : 'No se pudo iniciar el lector: ' + e.message);
      return false;
    }
  }
  const lectorActivo = () => !!lector;
  async function permisoNFC() { try { return (await navigator.permissions.query({ name: 'nfc' })).state === 'granted'; } catch (e) { return false; } }
  async function escribirTarjeta(db, uid, t) {
    normalizarTema(t, db.cfg);
    const p = codificar(t), s = await firmaTarjeta(db.clave, uid, p), url = urlTarjeta(p, s);
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 5000);
    cubierta('No retires la tarjeta', 'Guardando… espera la vibración larga.');
    try { await lector.write({ records: [{ recordType: 'url', data: url }] }, { signal: ctrl.signal }); vibrar(350); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'Se retiró la tarjeta antes de terminar. Acércala otra vez y déjala quieta.' : 'No se pudo escribir en la tarjeta (' + e.message + ').'); }
    finally { clearTimeout(timer); quitarCubierta(); }
  }

  /* ---------- Interfaz compartida ---------- */
  function montarUI() {
    if ($('#hoja')) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="hoja" class="hoja" hidden><div class="hoja-fondo" id="hojaFondo"></div><div class="hoja-panel" id="hojaCont" role="dialog" aria-modal="true"></div></div>
      <div id="cubierta" class="cubierta" hidden role="alert"><div class="cub-panel"><div class="cub-anillo"></div><b id="cubTitulo"></b><small id="cubSub"></small></div></div>
      <div id="toast" class="toast" hidden role="status"></div>`);
    $('#hojaFondo').onclick = () => { if (!$('#hoja').dataset.fija) cerrarHoja(); };
    $('#hojaCont').addEventListener('click', e => { if (e.target.closest('[data-x]')) cerrarHoja(); });
  }
  let toastT, autoCierre, cubiertaT;
  function toast(m) { montarUI(); const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3400); }
  function abrirHoja(html, fija, completa) {
    montarUI(); clearTimeout(autoCierre);
    const h = $('#hoja'); $('#hojaCont').innerHTML = html; $('#hojaCont').scrollTop = 0;
    h.dataset.fija = fija ? '1' : ''; h.classList.toggle('completa', !!completa); h.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => h.classList.add('abierta')));
    return $('#hojaCont');
  }
  function cerrarHoja() { const h = $('#hoja'); if (!h) return; h.classList.remove('abierta'); setTimeout(() => { if (!h.classList.contains('abierta')) h.hidden = true; }, 260); }
  const cerrarEn = ms => { clearTimeout(autoCierre); autoCierre = setTimeout(cerrarHoja, ms); };
  function cubierta(titulo, sub, clase, ms) {
    montarUI(); clearTimeout(cubiertaT);
    const c = $('#cubierta'); c.className = 'cubierta ' + (clase || ''); $('#cubTitulo').textContent = titulo; $('#cubSub').textContent = sub; c.hidden = false;
    if (ms) cubiertaT = setTimeout(() => c.hidden = true, ms);
  }
  const quitarCubierta = () => { clearTimeout(cubiertaT); const c = $('#cubierta'); if (c) c.hidden = true; };
  let actx;
  document.addEventListener('click', () => { try { actx = actx || new AudioContext(); } catch (e) {} }, { once: true });
  function sonar(tipo) {
    try {
      if (!actx) return; if (actx.state === 'suspended') actx.resume();
      const notas = tipo === 'cobrar' ? [523, 392] : tipo === 'error' ? [220, 220] : tipo === 'neutro' ? [587] : tipo === 'fiesta' ? [523, 659, 784, 1047] : [659, 988];
      notas.forEach((f, i) => {
        const t0 = actx.currentTime + i * .1, o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = f; g.gain.setValueAtTime(.0001, t0);
        g.gain.exponentialRampToValueAtTime(.18, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + .13);
        o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + .15);
      });
    } catch (e) {}
  }
  function pedirPIN({ titulo, texto = '', min = 4, max = 6, fija = false }) {
    return new Promise(res => {
      let v = '';
      const c = abrirHoja(`<div class="pin"><b class="pin-t">${esc(titulo)}</b>${texto ? `<p class="nota">${esc(texto)}</p>` : ''}<div class="pin-d" data-d></div>
        <div class="teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="b" aria-label="Borrar">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok">Listo</button></div>
        ${fija ? '' : '<button class="sec" data-k="cancel">Cancelar</button>'}</div>`, true, fija);
      const pintar = () => { c.querySelector('[data-d]').innerHTML = Array.from({ length: Math.max(min, v.length) }, (_, i) => `<i class="${i < v.length ? 'on' : ''}"></i>`).join(''); };
      const fin = r => { cerrarHoja(); res(r); };
      pintar();
      c.querySelector('.pin').onclick = e => {
        const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
        if (k === 'cancel') return fin(null);
        if (k === 'b') v = v.slice(0, -1);
        else if (k === 'ok') { if (v.length >= min) return fin(v); toast(`El PIN tiene de ${min} a ${max} dígitos.`); }
        else if (v.length < max) { v += k; vibrar(8); }
        pintar();
      };
    });
  }
  async function pinDocenteCorrecto(cfg, pin) { return !!pin && !!cfg.pinDocente && (await sha(cfg.pinDocente.salt + '|' + pin)) === cfg.pinDocente.hash; }
  async function bloquearSiHaceFalta(cfg) {
    if (!cfg?.pinDocente || !cfg.pinAlAbrir) return;
    for (;;) { const p = await pedirPIN({ titulo: 'PIN del docente', texto: 'El mismo PIN del Banco de Puntos.', fija: true }); if (await pinDocenteCorrecto(cfg, p)) return; sonar('error'); toast('PIN incorrecto.'); }
  }

  /* ---------- Piezas visuales ---------- */
  function tarjetaHTML(t, badge) {
    const e = emojiDe(t);
    return `<div class="tarjeta" style="${estilo(t)}">${e ? `<div class="t-emoji" aria-hidden="true">${e}</div>` : ''}<div class="t-top"><span>Banco de Puntos</span>${badge || ''}</div>
      <div class="t-saldo num">${fmt(t.saldo)}<small>pts</small></div><div class="t-nom">${esc(t.nombre)}</div><div class="t-cur">${esc(t.curso || '')}</div></div>`;
  }
  const avatar = t => `<span class="av${emojiDe(t) ? ' e' : ''}" style="${estilo(t)}">${emojiDe(t) || esc(iniciales(t.nombre))}</span>`;
  function cuentasHTML(t, cfg) {
    const cs = (t.cuentas || []).filter(x => x.s > 0).sort((a, b) => (a.c === 0 ? -1 : 0) - (b.c === 0 ? -1 : 0) || a.c - b.c);
    if (!cs.length) return '';
    return '<div class="cuentas">' + cs.map(x => `<div><span>${esc(nombreCuenta(x.c, cfg))}${x.c === 0 ? ' <small>común</small>' : ''}</span><b class="num">${fmt(x.s)}</b></div>`).join('') + '</div>';
  }
  const signo = p => `<span class="num ${p > 0 ? 'pos' : p < 0 ? 'neg' : 'cero'}">${p > 0 ? '+' : p < 0 ? '−' : ''}${fmt(Math.abs(p))}</span>`;
  function movsTarjetaHTML(t) {
    if (!t.movs.length) return '<p class="vacio">Sin movimientos.</p>';
    return '<div class="movs">' + t.movs.slice().reverse().map(m => `<div class="mov"><span><b>${esc(nombreMotivo(m.tipo, m.codigo))}</b><small>${fechaDia(m.dia)}${nombreDocente(m.docente) ? ', ' + esc(nombreDocente(m.docente)) : ''}${m.puntos && m.cuenta === 0 && m.tipo !== 'cierre' ? ', cuenta ' + esc(nombreCuenta(0)) : ''}</small></span>${signo(m.puntos)}</div>`).join('') + '</div>';
  }
  function qrSVG(texto) {
    if (typeof qrcode !== 'function') return '<p class="nota">No se pudo cargar el generador de QR.</p>';
    const q = qrcode(0, 'M'); q.addData(texto); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  /* ---------- CSV ---------- */
  function aCSV(filas, cols) {
    const e = v => { v = v == null ? '' : String(v); return /[";\n\r,]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '\ufeff' + [cols.join(';'), ...filas.map(f => cols.map(c => e(f[c])).join(';'))].join('\r\n');
  }
  function leerCSV(txt) {
    txt = txt.replace(/^\ufeff/, '');
    const pl = txt.split(/\r?\n/)[0], sep = pl.split(';').length >= pl.split(',').length ? ';' : ',';
    const filas = []; let f = [], v = '', q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { f.push(v); v = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; f.push(v); filas.push(f); f = []; v = ''; }
      else v += ch;
    }
    if (v !== '' || f.length) { f.push(v); filas.push(f); }
    const cab = (filas.shift() || []).map(h => h.trim().toLowerCase());
    return { cab, filas: filas.filter(r => r.some(x => x.trim() !== '')).map(r => Object.fromEntries(cab.map((h, i) => [h, (r[i] ?? '').trim()]))) };
  }
  function descargar(nombre, texto, tipo = 'text/csv;charset=utf-8') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nombre;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  async function compartirArchivos(archivos, titulo) {
    const fs = archivos.map(a => new File([a.texto], a.nombre, { type: 'text/csv' }));
    if (navigator.canShare && navigator.canShare({ files: fs })) {
      try { await navigator.share({ files: fs, title: titulo }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
    }
    archivos.forEach((a, i) => setTimeout(() => descargar(a.nombre, a.texto), i * 600)); return true;
  }

  function registrarSW() { if ('serviceWorker' in navigator) navigator.serviceWorker.register(new URL('sw.js', RAIZ), { scope: RAIZ }).catch(() => {}); }

  return {
    $, $$, esc, fmt, pct, clon, b64e, b64d, hoyDia, fechaDia, isoDia, hoyISO, cuando, fechaCorta, iniciales, vibrar,
    leerBanco, guardarBanco, activos, cursosDe, get cat() { return cat; }, actualizarCatalogo, nombreMotivo, nombreDocente, nombreCuenta,
    PALETA, EMOJIS, colorCurso, temaDe, emojiDe, estilo,
    codificar, decodificar, recalcular, saldoCuenta, aplicarMov, aplicarAsistencia, movLocal,
    urlTarjeta, urlDesdeRegistro, leerTexto, leerNFC, evaluar, prepararT,
    NFC, activarLector, lectorActivo, permisoNFC, escribirTarjeta,
    montarUI, toast, abrirHoja, cerrarHoja, cerrarEn, cubierta, quitarCubierta, sonar, pedirPIN, pinDocenteCorrecto, bloquearSiHaceFalta,
    tarjetaHTML, avatar, cuentasHTML, signo, movsTarjetaHTML, qrSVG,
    aCSV, leerCSV, descargar, compartirArchivos, registrarSW
  };
})();
