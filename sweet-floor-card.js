/*! Sweet Floor Card 1.0.0 | MIT
 *  A dependency-free "dollhouse" dashboard card for Home Assistant.
 *  Layout inspired by mousawm/sweet-home, live look inspired by therealMRBK/NextFloor.
 *  One file. No build step. No external requests.
 */
(function () {
  'use strict';
  var VERSION = '1.1.0';
  var TAG = 'sweet-floor-card';

  /* ======================================================================
   * Small helpers
   * ==================================================================== */
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (x, a, b) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var hex = function (h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  var mixA = function (a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; };
  var css = function (a, al) {
    var s = Math.round(a[0]) + ',' + Math.round(a[1]) + ',' + Math.round(a[2]);
    return al == null ? 'rgb(' + s + ')' : 'rgba(' + s + ',' + al + ')';
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var num = function (v) { var n = parseFloat(v); return isFinite(n) ? n : null; };
  var domainOf = function (id) { return id.slice(0, id.indexOf('.')); };
  var normName = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); };
  var fmt = function (n, d) {
    if (n == null || !isFinite(n)) return '–';
    return n.toLocaleString(undefined, { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: 0 });
  };
  var fmtPower = function (w) {
    if (w == null) return '–';
    var a = Math.abs(w);
    return a >= 1000 ? fmt(w / 1000, 2) + ' kW' : Math.round(w) + ' W';
  };
  var setA = function (el, name, val) {
    if (!el) return;
    var c = el.__a || (el.__a = {});
    if (c[name] === val) return;
    c[name] = val;
    el.setAttribute(name, val);
  };
  var setS = function (el, prop, val) {
    if (!el) return;
    var c = el.__s || (el.__s = {});
    if (c[prop] === val) return;
    c[prop] = val;
    el.style.setProperty(prop, val);
  };
  var setT = function (el, txt) { if (el && el.textContent !== txt) el.textContent = txt; };
  var setC = function (el, cls, on) { if (el) el.classList.toggle(cls, !!on); };
  var parseHour = function (v) {
    if (typeof v === 'number') return v;
    var m = /^(\d{1,2})(?::(\d{2}))?/.exec(String(v));
    return m ? (+m[1]) + (m[2] ? +m[2] / 60 : 0) : 12;
  };

  /* Colour temperature (kelvin) -> rgb */
  function kelvinRGB(k) {
    var t = clamp(k, 1000, 12000) / 100, r, g, b;
    if (t <= 66) {
      r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661;
      b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255;
    }
    return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
  }

  /* ======================================================================
   * Entity classification
   * ==================================================================== */
  var TV_RE = /(^|[_\s.])(tv|television)([_\s.]|$)|bravia|webos|tizen|roku|apple_?tv|android_?tv|fire_?tv|google_?tv|chromecast|lg_?tv|samsung_?tv|vizio/i;
  function isTV(id, st) {
    var a = st.attributes || {};
    if (a.device_class === 'tv') return true;
    if (a.device_class === 'speaker' || a.device_class === 'receiver') return false;
    return TV_RE.test(id) || TV_RE.test(a.friendly_name || '');
  }
  var DOMAINS = { light: 1, switch: 1, fan: 1, media_player: 1, climate: 1, cover: 1, vacuum: 1, lock: 1, binary_sensor: 1, sensor: 1 };
  var PUCK = { light: 1, switch: 1, fan: 1, tv: 1, speaker: 1, climate: 1, cover: 1, vacuum: 1, lock: 1 };
  var PUCK_ORDER = ['tv', 'light', 'climate', 'fan', 'speaker', 'switch', 'cover', 'vacuum', 'lock'];
  var ICON = { light: '💡', switch: '🔌', fan: '🌀', tv: '📺', speaker: '🔊', climate: '❄️', cover: '🪟', vacuum: '🤖', lock: '🔒' };
  var ACCENT = { tv: [106, 184, 255], fan: [120, 220, 200], speaker: [190, 150, 255], switch: [255, 205, 120], climate: [255, 150, 90], cover: [200, 220, 255], vacuum: [120, 220, 160], lock: [255, 120, 120] };

  function classify(id, st) {
    var dom = domainOf(id), a = st.attributes || {}, dc = a.device_class;
    switch (dom) {
      case 'light': return 'light';
      case 'switch': return 'switch';
      case 'fan': return 'fan';
      case 'media_player': return isTV(id, st) ? 'tv' : 'speaker';
      case 'climate': return 'climate';
      case 'cover': return 'cover';
      case 'vacuum': return 'vacuum';
      case 'lock': return 'lock';
      case 'binary_sensor':
        if (dc === 'motion' || dc === 'occupancy' || dc === 'presence' || dc === 'moving') return 'motion';
        if (dc === 'door' || dc === 'window' || dc === 'garage_door' || dc === 'opening') return 'opening';
        if (dc === 'smoke' || dc === 'gas' || dc === 'carbon_monoxide' || dc === 'moisture' || dc === 'safety') return 'alarm';
        if (!dc && /person|presence|occupan|motion/i.test(id)) return 'motion';
        return null;
      case 'sensor':
        if (dc === 'temperature') return 'temp';
        if (dc === 'humidity') return 'hum';
        return null;
    }
    return null;
  }

  function isOn(kind, st) {
    var s = st && st.state;
    if (!s || s === 'unavailable' || s === 'unknown') return false;
    var a = st.attributes || {};
    switch (kind) {
      case 'tv': case 'speaker': return s === 'on' || s === 'playing' || s === 'paused' || s === 'buffering';
      case 'climate':
        if (a.hvac_action) return a.hvac_action !== 'off' && a.hvac_action !== 'idle';
        return s !== 'off';
      case 'cover': return s === 'open' || s === 'opening' || s === 'closing';
      case 'vacuum': return s === 'cleaning' || s === 'returning';
      case 'lock': return s === 'unlocked' || s === 'unlocking' || s === 'open';
      default: return s === 'on';
    }
  }
  function lightBri(st) {
    var b = num(st.attributes && st.attributes.brightness);
    return b == null ? 1 : clamp(b / 255, 0.08, 1);
  }
  function hsToRGB(h, s) {
    var c = s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = 1 - c;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [clamp((r + m) * 255, 0, 255), clamp((g + m) * 255, 0, 255), clamp((b + m) * 255, 0, 255)];
  }

  function lightRGB(st) {
    var a = st.attributes || {};
    if (Array.isArray(a.rgb_color) && a.rgb_color.length >= 3) return [a.rgb_color[0], a.rgb_color[1], a.rgb_color[2]];
    var k = num(a.color_temp_kelvin) || (num(a.color_temp) ? Math.round(1000000 / a.color_temp) : null);
    if (k) return mixA(kelvinRGB(k), [255, 200, 130], 0.25);
    if (Array.isArray(a.hs_color) && a.hs_color.length >= 2) {
      return hsToRGB(a.hs_color[0], a.hs_color[1] / 100);
    }
    return [255, 214, 150];
  }
  function accentFor(kind, st) {
    if (kind === 'light') return lightRGB(st);
    if (kind === 'climate') return (st.attributes && st.attributes.hvac_action === 'cooling') ? [120, 200, 255] : [255, 150, 90];
    return ACCENT[kind] || [255, 205, 120];
  }

  /* Light contribution of a room (lights + TV + "any other device on") */
  function roomGlow(devs, S) {
    var keep = 1, acc = [0, 0, 0], wsum = 0, lights = 0, tvs = 0, other = 0;
    devs.forEach(function (d) {
      var st = S[d.id];
      if (!st || !isOn(d.kind, st)) return;
      var w, col;
      if (d.kind === 'light') { w = 0.35 + 0.5 * lightBri(st); col = lightRGB(st); lights++; }
      else if (d.kind === 'tv') { w = 0.5; col = [110, 170, 255]; tvs++; }
      else { w = 0.16; col = accentFor(d.kind, st); other++; }
      keep *= (1 - w);
      acc[0] += col[0] * w; acc[1] += col[1] * w; acc[2] += col[2] * w; wsum += w;
    });
    return {
      i: 1 - keep,
      rgb: wsum ? [acc[0] / wsum, acc[1] / wsum, acc[2] / wsum] : [255, 214, 150],
      lights: lights, tvs: tvs, other: other, any: wsum > 0
    };
  }

  /* ======================================================================
   * Day / night environment (sun.sun with clock fallback)
   * ==================================================================== */
  var HORIZON = 60; // % of card height
  function computeEnv(hass, cfg, now) {
    var sun = hass.states[cfg.sun_entity || 'sun.sun'];
    var hour = now.getHours() + now.getMinutes() / 60;
    var preview = cfg.preview_hour != null;
    if (preview) hour = parseHour(cfg.preview_hour);
    var elev, az, src = 'clock';
    if (!preview && sun && sun.attributes && isFinite(sun.attributes.elevation)) {
      elev = +sun.attributes.elevation;
      az = isFinite(sun.attributes.azimuth) ? +sun.attributes.azimuth : 180;
      src = 'sun.sun';
    } else {
      var p = (hour - 6) / 12;
      elev = 64 * Math.sin(Math.PI * p);
      az = (((90 + 180 * p) % 360) + 360) % 360;
    }
    var dayK = smooth(elev, -5, 9);
    var warm = Math.exp(-Math.pow((elev - 2) / 6, 2));
    var env = { elev: elev, az: az, dayK: dayK, warm: warm, hour: hour, src: src, night: 1 - dayK };

    // sky
    var top = mixA([7, 11, 31], [78, 154, 247], dayK), bot = mixA([24, 36, 86], [196, 226, 252], dayK);
    top = mixA(top, [70, 60, 120], warm * 0.5); bot = mixA(bot, [255, 150, 90], warm * 0.65);
    env.skyTop = top; env.skyBot = bot;

    // sun and moon positions (east on the left, west on the right: facing south)
    var fx = clamp((az - 55) / 250, 0, 1);
    env.sunX = 8 + fx * 84;
    env.sunY = HORIZON - Math.sin(elev * Math.PI / 180) * (HORIZON - 9);
    env.sunVis = smooth(elev, -4, 1.5);
    env.sunCol = mixA([255, 246, 214], [255, 140, 60], warm);
    var nh = ((hour - 18) % 24 + 24) % 24;
    var f = clamp(nh / 12, 0, 1);
    env.moonX = 10 + f * 80;
    env.moonY = HORIZON - Math.sin(Math.PI * f) * (HORIZON - 12) * 0.92;
    env.moonVis = 1 - smooth(elev, -9, -1);

    // UI colours
    var k = smooth(dayK, 0.35, 0.65);
    env.fg = mixA([232, 238, 252], [26, 36, 48], k);
    env.glass = mixA([18, 24, 52], [255, 255, 255], k);
    env.glassA = lerp(0.58, 0.72, k);
    env.sheet = mixA([20, 27, 56], [250, 252, 255], k);

    // house palette
    var D = {
      floor: '#e2d9c8', wallN: '#f4f6f8', wallW: '#e3e8ee', cap: '#ffffff', low: '#d3d9e0',
      edge: '#aab2bd', base: '#9fb78c', baseSide: '#7f9770', text: '#34404c', halo: '#ffffff', win: '#bfe2ff'
    };
    var N = {
      floor: '#252f4d', wallN: '#34426a', wallW: '#2a3659', cap: '#4a5a88', low: '#232d4c',
      edge: '#0f1530', base: '#1c2c34', baseSide: '#142026', text: '#b9c5e6', halo: '#0b1026', win: '#0e1838'
    };
    var pal = {};
    Object.keys(D).forEach(function (key) {
      var c = mixA(hex(N[key]), hex(D[key]), dayK);
      if (key !== 'halo' && key !== 'text') c = mixA(c, [255, 176, 110], warm * 0.14);
      pal[key] = c;
    });
    env.pal = pal;
    return env;
  }

  /* ======================================================================
   * WebSocket Registries & Smart Room Inferrer
   * ==================================================================== */
  function fetchRegistries(hass) {
    if (!hass || typeof hass.callWS !== 'function') return Promise.resolve(null);
    var pA = hass.callWS({ type: 'config/area_registry/list' }).catch(function () { return []; });
    var pD = hass.callWS({ type: 'config/device_registry/list' }).catch(function () { return []; });
    var pE = hass.callWS({ type: 'config/entity_registry/list' }).catch(function () { return []; });
    var pF = hass.callWS({ type: 'config/floor_registry/list' }).catch(function () { return []; });
    return Promise.all([pA, pD, pE, pF]).then(function (res) {
      var areas = {}, devices = {}, entities = {}, floors = {};
      (res[0] || []).forEach(function (a) { if (a && a.area_id) areas[a.area_id] = a; });
      (res[1] || []).forEach(function (d) { if (d && d.id) devices[d.id] = d; });
      (res[2] || []).forEach(function (e) { if (e && e.entity_id) entities[e.entity_id] = e; });
      (res[3] || []).forEach(function (f) { if (f && f.floor_id) floors[f.floor_id] = f; });
      return { areas: areas, devices: devices, entities: entities, floors: floors };
    });
  }

  var ROOM_KEYWORDS = [
    'living_room', 'living', 'kitchen', 'bedroom', 'master_bedroom', 'office', 'study',
    'hallway', 'hall', 'corridor', 'bathroom', 'bath', 'toilet', 'garage', 'dining_room',
    'dining', 'basement', 'patio', 'garden', 'attic', 'laundry', 'kids_room', 'nursery',
    'guest_room', 'balcony', 'porch'
  ];

  function formatAreaName(s) {
    if (!s) return 'Room';
    return String(s)
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function inferArea(id, st) {
    var name = (id + ' ' + (st && st.attributes && st.attributes.friendly_name ? st.attributes.friendly_name : '')).toLowerCase();
    for (var i = 0; i < ROOM_KEYWORDS.length; i++) {
      var kw = ROOM_KEYWORDS[i];
      var re = new RegExp('(^|[._\\s])' + kw + '([._\\s]|$)', 'i');
      if (re.test(name)) {
        if (kw === 'living') return 'living_room';
        if (kw === 'hall' || kw === 'corridor') return 'hallway';
        if (kw === 'bath' || kw === 'toilet') return 'bathroom';
        if (kw === 'dining') return 'dining_room';
        if (kw === 'study') return 'office';
        return kw;
      }
    }
    return null;
  }
  /* ======================================================================
   * Room model (auto from HA areas, or manual `rooms:`)
   * ==================================================================== */
  function buildModel(hass, cfg, registries) {
    var S = hass.states;
    var regs = registries || window.__ha_registries || {};
    var reg = regs.entities || hass.entities || {};
    var dreg = regs.devices || hass.devices || {};
    var areas = regs.areas || hass.areas || {};
    var floors = regs.floors || hass.floors || {};
    var exclude = {};
    (cfg.exclude || []).forEach(function (e) { exclude[e] = 1; });

    var areaOf = function (id) {
      var e = reg[id];
      if (!e) return null;
      if (e.area_id) return e.area_id;
      if (e.device_id && dreg[e.device_id]) return dreg[e.device_id].area_id || null;
      return null;
    };
    var byArea = {}, unassigned = [];
    Object.keys(S).forEach(function (id) {
      var dom = domainOf(id);
      if (!DOMAINS[dom] || exclude[id]) return;
      var r = reg[id];
      if (r && (r.hidden || r.entity_category)) return;
      var a = areaOf(id);
      if (a) (byArea[a] = byArea[a] || []).push(id);
      else unassigned.push(id);
    });

    var rooms = [];
    if (Array.isArray(cfg.rooms) && cfg.rooms.length) {
      cfg.rooms.forEach(function (r, i) {
        var a = r.area;
        rooms.push({
          id: String(r.id || a || 'room' + i),
          name: r.name || (a && areas[a] && areas[a].name) || (a ? formatAreaName(a) : 'Room ' + (i + 1)),
          area: a, floor: r.floor != null ? String(r.floor) : '_',
          x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h),
          extra: r.entities || [], devPos: r.devices || {}
        });
      });
    } else if (Object.keys(areas).length > 0) {
      var ids = Object.keys(areas);
      if (Array.isArray(cfg.areas) && cfg.areas.length) ids = ids.filter(function (a) { return cfg.areas.indexOf(a) >= 0; });
      ids.forEach(function (a) {
        rooms.push({
          id: a, name: (areas[a] && areas[a].name) || formatAreaName(a),
          area: a, floor: (areas[a] && areas[a].floor_id) || '_',
          extra: [], devPos: {}
        });
      });
    } else {
      // Smart Fallback: Infer areas from entity names
      var inferred = {};
      unassigned.forEach(function (id) {
        var ia = inferArea(id, S[id]);
        if (ia) {
          (inferred[ia] = inferred[ia] || []).push(id);
        }
      });
      var infKeys = Object.keys(inferred);
      if (infKeys.length > 0) {
        infKeys.forEach(function (ia) {
          rooms.push({
            id: ia,
            name: formatAreaName(ia),
            area: ia,
            floor: (ia.indexOf('bed') >= 0 || ia.indexOf('bath') >= 0 || ia.indexOf('kids') >= 0) ? 'upstairs' : 'ground',
            extra: inferred[ia],
            devPos: {}
          });
        });
        var inferredSet = {};
        infKeys.forEach(function(k) { inferred[k].forEach(function(x) { inferredSet[x] = 1; }); });
        unassigned = unassigned.filter(function(x) { return !inferredSet[x]; });
      } else {
        rooms.push({ id: '_home', name: cfg.title || 'Home', area: null, floor: '_', extra: unassigned.slice(0, 12), devPos: {}, fallback: true });
      }
    }

    rooms.forEach(function (r) {
      r.devs = []; r.motion = []; r.openings = []; r.alarms = []; r.temp = null; r.hum = null;
      var list = (r.area && byArea[r.area] ? byArea[r.area] : []).concat(r.extra || []);
      var seen = {};
      var aname = r.name;
      list.sort().forEach(function (id) {
        if (seen[id]) return; seen[id] = 1;
        var s = S[id]; if (!s) return;
        var k = classify(id, s); if (!k) return;
        var fn = (s.attributes && s.attributes.friendly_name) || id;
        var nm = fn;
        if (aname && fn.toLowerCase().indexOf(aname.toLowerCase()) === 0 && fn.length > aname.length) nm = fn.slice(aname.length).replace(/^[\s:_-]+/, '') || fn;
        if (PUCK[k]) r.devs.push({ id: id, kind: k, name: nm });
        else if (k === 'motion') r.motion.push(id);
        else if (k === 'opening') r.openings.push(id);
        else if (k === 'alarm') r.alarms.push(id);
        else if (k === 'temp' && !r.temp) r.temp = id;
        else if (k === 'hum' && !r.hum) r.hum = id;
      });
      r.devs.sort(function (a, b) { return PUCK_ORDER.indexOf(a.kind) - PUCK_ORDER.indexOf(b.kind); });
      r.puck = r.devs.slice(0, 8);
    });

    // floors
    var byFloor = {};
    rooms.forEach(function (r) { (byFloor[r.floor] = byFloor[r.floor] || []).push(r); });
    var fl = Object.keys(byFloor).map(function (fid) {
      var f = floors[fid];
      return { id: fid, name: (f && f.name) || (fid === '_' ? 'Home' : fid), level: f && isFinite(f.level) ? f.level : 0, rooms: byFloor[fid] };
    }).sort(function (a, b) { return a.level - b.level; });
    fl.forEach(layoutFloor);
    return { rooms: rooms, floors: fl, unassigned: unassigned };
  }

  function layoutFloor(f) {
    var explicit = f.rooms.filter(function (r) { return r.x != null && r.y != null; });
    var auto = f.rooms.filter(function (r) { return !(r.x != null && r.y != null); });
    explicit.forEach(function (r) { r.w = r.w || 4; r.h = r.h || 3.4; });
    var y0 = 0;
    explicit.forEach(function (r) { y0 = Math.max(y0, r.y + r.h); });
    auto.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var n = auto.length, cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    auto.forEach(function (r, i) {
      r.w = r.w || 4; r.h = r.h || 3.4;
      r.x = (i % cols) * 4; r.y = y0 + Math.floor(i / cols) * 3.4;
    });
    f.rooms.forEach(function (r) { r.x1 = r.x + r.w; r.y1 = r.y + r.h; });
  }

  function neighbor(r, side, all) {
    var e = 0.01;
    for (var i = 0; i < all.length; i++) {
      var o = all[i]; if (o === r) continue;
      var ox = Math.min(r.x1, o.x1) - Math.max(r.x, o.x), oy = Math.min(r.y1, o.y1) - Math.max(r.y, o.y);
      if (side === 'n' && Math.abs(o.y1 - r.y) < e && ox > e) return true;
      if (side === 'w' && Math.abs(o.x1 - r.x) < e && oy > e) return true;
    }
    return false;
  }

  /* ======================================================================
   * Iso projection + SVG scene
   * ==================================================================== */
  var TW = 34, TH = 17, WALL_H = 50, LOW_H = 12, WT = 0.16;
  var iso = function (x, y, z) { return [(x - y) * TW, (x + y) * TH - (z || 0)]; };
  var pts = function (arr) {
    return arr.map(function (p) { var q = iso(p[0], p[1], p[2]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
  };
  var poly = function (arr, attrs) { return '<polygon points="' + pts(arr) + '" ' + (attrs || '') + '/>'; };

  function devPos(r, i, count) {
    var ov = r.devPos && r.devPos[r.puck[i].id];
    if (ov && num(ov.x) != null && num(ov.y) != null) return [r.x + clamp(ov.x, 0, 1) * r.w, r.y + clamp(ov.y, 0, 1) * r.h];
    var cols = Math.min(count, Math.max(1, Math.round(Math.sqrt(count * r.w / r.h))));
    var rows = Math.ceil(count / cols);
    var c = i % cols, rr = Math.floor(i / cols);
    var inCol = (rr === rows - 1) ? (count - (rows - 1) * cols) : cols; // centre a short last row
    var cc = c + (cols - inCol) / 2;
    return [r.x + 0.75 + (cc + 0.5) * (r.w - 1.5) / cols, r.y + 0.6 + (rr + 0.5) * (r.h - 2.65) / rows];
  }

  /* ======================================================================
   * Energy helpers (uses the built-in Energy dashboard preferences)
   * ==================================================================== */
  function powerRefs(obj, sign) {
    var out = [];
    if (!obj) return out;
    var add = function (id, sg) { if (typeof id === 'string' && id) out.push({ id: id, sign: sg }); };
    sign = sign || 1;
    add(obj.stat_rate, sign);
    var pc = obj.power_config;
    if (pc) {
      add(pc.stat_rate, sign); add(pc.stat_rate_inverted, -sign);
      add(pc.stat_rate_from, sign); add(pc.stat_rate_to, -sign);
    }
    return out;
  }
  function pushU(arr, v) { if (typeof v === 'string' && v && arr.indexOf(v) < 0) arr.push(v); }
  function listOf(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }

  function parseEnergy(prefs, ov, S) {
    ov = ov || {};
    var o = {
      grid: { power: [], from: [], to: [] }, solar: { power: [], energy: [] },
      battery: { power: [], from: [], to: [] }, gas: { energy: [] }, water: { energy: [] },
      devices: [], home: null, auto: [], fromPrefs: !!prefs
    };
    var addP = function (arr, obj, sg) {
      powerRefs(obj, sg).forEach(function (r) { if (!arr.some(function (x) { return x.id === r.id; })) arr.push(r); });
    };
    ((prefs && prefs.energy_sources) || []).forEach(function (s) {
      switch (s.type) {
        case 'grid':
          (s.flow_from || []).forEach(function (f) { pushU(o.grid.from, f.stat_energy_from); addP(o.grid.power, f, 1); });
          (s.flow_to || []).forEach(function (t) { pushU(o.grid.to, t.stat_energy_to); addP(o.grid.power, t, -1); });
          (s.power || []).forEach(function (p) { addP(o.grid.power, p, 1); });
          pushU(o.grid.from, s.stat_energy_from); pushU(o.grid.to, s.stat_energy_to);
          break;
        case 'solar': pushU(o.solar.energy, s.stat_energy_from); addP(o.solar.power, s, 1); break;
        case 'battery': pushU(o.battery.from, s.stat_energy_from); pushU(o.battery.to, s.stat_energy_to); addP(o.battery.power, s, 1); break;
        case 'gas': pushU(o.gas.energy, s.stat_energy_from); break;
        case 'water': pushU(o.water.energy, s.stat_energy_from); break;
      }
    });
    ((prefs && prefs.device_consumption) || []).forEach(function (d) {
      if (d && d.stat_consumption) o.devices.push({ stat: d.stat_consumption, name: d.name });
    });

    // explicit overrides from card config always win
    var pw = function (v, invert) { return listOf(v).map(function (id) { return { id: id, sign: invert ? -1 : 1 }; }); };
    if (ov.grid_power) o.grid.power = pw(ov.grid_power, ov.grid_power_invert);
    if (ov.solar_power) o.solar.power = pw(ov.solar_power);
    if (ov.battery_power) o.battery.power = pw(ov.battery_power, ov.battery_power_invert);
    if (ov.home_power) o.home = listOf(ov.home_power)[0];
    if (ov.grid_import) o.grid.from = listOf(ov.grid_import);
    if (ov.grid_export) o.grid.to = listOf(ov.grid_export);
    if (ov.solar_energy) o.solar.energy = listOf(ov.solar_energy);
    if (ov.gas) o.gas.energy = listOf(ov.gas);

    // auto-detect whatever is still missing
    var ents = Object.keys(S).filter(function (id) { return domainOf(id) === 'sensor'; }).map(function (id) {
      var a = S[id].attributes || {};
      return { id: id, dc: a.device_class, sc: a.state_class, unit: a.unit_of_measurement, name: (id + ' ' + (a.friendly_name || '')).toLowerCase() };
    });
    var findP = function (inc, exc) {
      return ents.filter(function (e) { return e.dc === 'power' && inc.test(e.name) && !(exc && exc.test(e.name)); })[0];
    };
    if (!o.grid.power.length && !o.home) {
      var g = findP(/grid|mains|net_power|import|house|home|consumption|total_power|whole/, /solar|pv|battery|inverter|plug|heater|pump|car|ev_/);
      if (g) { o.grid.power.push({ id: g.id, sign: 1 }); o.auto.push(g.id); }
    }
    if (!o.solar.power.length) {
      var sp = findP(/solar|pv|photovolt|inverter|generation|production/, /battery/);
      if (sp) { o.solar.power.push({ id: sp.id, sign: 1 }); o.auto.push(sp.id); }
    }
    if (!o.battery.power.length) {
      var bp = findP(/battery.*power|powerwall.*power|storage.*power/, /grid|solar/);
      if (bp) { o.battery.power.push({ id: bp.id, sign: 1 }); o.auto.push(bp.id); }
    }
    if (!o.gas.energy.length) {
      var gs = ents.filter(function (e) {
        var u = (e.unit || '').toLowerCase();
        var gasUnit = ['m³', 'm3', 'ft³', 'ft3', 'ccf', 'mcf', 'hcf', 'therms', 'therm'].indexOf(u) >= 0;
        return (e.dc === 'gas') ||
          (gasUnit && /gas/i.test(e.name)) ||
          (/gas/i.test(e.name) && (e.dc === 'energy' || gasUnit || e.sc || /meter|consum|total/i.test(e.name)));
      })[0];
      if (gs) { o.gas.energy.push(gs.id); o.auto.push(gs.id); }
    }
    if (!o.grid.from.length) {
      var gi = ents.filter(function (e) {
        return e.dc === 'energy' && (e.sc === 'total_increasing' || e.sc === 'total') &&
          /import|consum|grid|mains|total_energy|energy_total|from_grid/.test(e.name) && !/gas|solar|export|return|feed|to_grid|pv|battery/.test(e.name);
      })[0];
      if (gi) { o.grid.from.push(gi.id); o.auto.push(gi.id); }
    }
    if (!o.solar.energy.length) {
      var se = ents.filter(function (e) {
        return e.dc === 'energy' && (e.sc === 'total_increasing' || e.sc === 'total') && /solar|pv|production|yield|generat/.test(e.name);
      })[0];
      if (se) { o.solar.energy.push(se.id); o.auto.push(se.id); }
    }
    return o;
  }

  function readW(S, id) {
    var s = S[id]; if (!s) return null;
    var v = num(s.state); if (v == null) return null;
    var u = (s.attributes && s.attributes.unit_of_measurement) || 'W';
    if (u === 'kW') return v * 1000;
    if (u === 'MW') return v * 1e6;
    if (u === 'mW') return v / 1000;
    return v;
  }
  function sumW(S, list) {
    var t = 0, any = false;
    list.forEach(function (r) { var v = readW(S, r.id); if (v != null) { t += v * r.sign; any = true; } });
    return any ? t : null;
  }
  function powerNow(src, S) {
    var g = sumW(S, src.grid.power), s = sumW(S, src.solar.power), b = sumW(S, src.battery.power);
    var home = src.home ? readW(S, src.home) : null;
    if (home == null && (g != null || s != null)) home = Math.max(0, (g || 0) + (s || 0) + (b || 0));
    return { grid: g, solar: s, battery: b, home: home };
  }

  function unitOf(stats, S, id) {
    return (stats && stats.units && stats.units[id]) || (S[id] && S[id].attributes && S[id].attributes.unit_of_measurement) || '';
  }
  function energyConv(unit) { return unit === 'Wh' ? 0.001 : unit === 'MWh' ? 1000 : 1; }

  function fetchStats(hass, src) {
    var all = [];
    [src.grid.from, src.grid.to, src.solar.energy, src.battery.from, src.battery.to, src.gas.energy, src.water.energy,
      src.devices.map(function (d) { return d.stat; })].forEach(function (l) { l.forEach(function (id) { pushU(all, id); }); });
    var out = { hourly: {}, daily: {}, units: {}, ok: false, ids: all };
    if (!all.length) return Promise.resolve(out);
    var midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    var weekStart = new Date(midnight); weekStart.setDate(weekStart.getDate() - 6);
    var ws = function (p) { return hass.callWS(p); };
    var p1 = ws({ type: 'recorder/statistics_during_period', start_time: midnight.toISOString(), statistic_ids: all, period: 'hour', types: ['change'] })
      .then(function (r) { out.hourly = r || {}; out.ok = true; }).catch(function (e) { out.err = String((e && e.message) || e); });
    var p2 = ws({ type: 'recorder/statistics_during_period', start_time: weekStart.toISOString(), statistic_ids: all, period: 'day', types: ['change'] })
      .then(function (r) { out.daily = r || {}; }).catch(function () { });
    var p3 = ws({ type: 'recorder/get_statistics_metadata', statistic_ids: all })
      .then(function (m) {
        (m || []).forEach(function (x) { out.units[x.statistic_id] = x.display_unit_of_measurement || x.statistics_unit_of_measurement || x.unit_of_measurement; });
      }).catch(function () { });
    return Promise.all([p1, p2, p3]).then(function () { return out; });
  }

  function sumHours(stats, S, ids, conv) {
    var arr = new Array(24).fill(0), any = false;
    ids.forEach(function (id) {
      var k = conv ? energyConv(unitOf(stats, S, id)) : 1;
      (stats.hourly[id] || []).forEach(function (p) {
        if (p.change == null) return;
        arr[new Date(p.start).getHours()] += p.change * k; any = true;
      });
    });
    return any ? arr : null;
  }
  function sumDays(stats, S, ids, conv) {
    var base = new Date(); base.setHours(0, 0, 0, 0);
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(base); d.setDate(d.getDate() - i);
      days.push({ key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: 'short' }), v: 0 });
    }
    var any = false;
    ids.forEach(function (id) {
      var k = conv ? energyConv(unitOf(stats, S, id)) : 1;
      (stats.daily[id] || []).forEach(function (p) {
        if (p.change == null) return;
        var key = new Date(p.start).toDateString();
        for (var j = 0; j < days.length; j++) if (days[j].key === key) { days[j].v += p.change * k; any = true; }
      });
    });
    return any ? days : null;
  }
  /* Fallback when long-term statistics are not available: remember the meter at first sight today */
  function baselineToday(S, ids, conv, stats) {
    var tot = 0, any = false, day = new Date().toDateString();
    ids.forEach(function (id) {
      var v = num(S[id] && S[id].state); if (v == null) return;
      var key = 'sfc-base-' + id, rec = null;
      try { rec = JSON.parse(localStorage.getItem(key)); } catch (e) { rec = null; }
      if (!rec || rec.d !== day || rec.v > v) {
        rec = { d: day, v: v };
        try { localStorage.setItem(key, JSON.stringify(rec)); } catch (e) { /* ignore */ }
      }
      tot += (v - rec.v) * (conv ? energyConv(unitOf(stats, S, id)) : 1); any = true;
    });
    return any ? tot : null;
  }

  /* ======================================================================
   * CSS
   * ==================================================================== */
  var STYLE = [
    ':host{display:block}',
    'ha-card{display:block;position:relative;overflow:hidden;background:none!important;border:none;box-shadow:none}',
    '.card{--fg:#1a2430;--glass:rgba(255,255,255,.72);--sheet:rgb(250,252,255);--lbl:#34404c;--halo:#fff;--edge:#aab2bd;--sun:#fff6d6;--cloud:rgba(255,255,255,.85);--rain:rgba(190,215,255,.65);',
    'position:relative;display:flex;flex-direction:column;height:var(--h,680px);min-height:520px;overflow:hidden;border-radius:var(--ha-card-border-radius,16px);',
    'background:linear-gradient(var(--sky-top,#4e9af7),var(--sky-bot,#c4e2fc));color:var(--fg);',
    'font-family:var(--sf-font,ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif);-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}',
    '.card *{box-sizing:border-box}',
    'button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;padding:0}',
    /* sky */
    '.sky{position:absolute;inset:0;overflow:hidden;pointer-events:none}',
    '.stars{position:absolute;inset:0;transition:opacity 2s}',
    '.star{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;animation:twinkle 4s ease-in-out infinite}',
    '@keyframes twinkle{0%,100%{opacity:.25}50%{opacity:1}}',
    '.sun{position:absolute;width:66px;height:66px;margin:-33px 0 0 -33px;border-radius:50%;',
    'background:radial-gradient(circle,#fff 0 20%,var(--sun) 24% 100%);box-shadow:0 0 46px 16px var(--sun-glow,rgba(255,240,200,.5));',
    'transition:left 4s linear,top 4s linear,opacity 3s}',
    '.moon{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;box-shadow:inset -13px -5px 0 0 #eef1ff;',
    'filter:drop-shadow(0 0 12px rgba(190,205,255,.7));transform:rotate(-18deg);transition:left 4s linear,top 4s linear,opacity 3s}',
    '.arc{position:absolute;left:8%;right:8%;top:9%;height:51%;border:2px dashed rgba(255,255,255,.22);border-bottom:0;border-radius:50% 50% 0 0/100% 100% 0 0;transition:opacity 2s}',
    '.cloud{position:absolute;height:24px;border-radius:30px;background:var(--cloud);animation:drift linear infinite;transition:opacity 3s}',
    '.cloud::before,.cloud::after{content:"";position:absolute;background:inherit;border-radius:50%}',
    '.cloud::before{width:42%;height:150%;left:14%;top:-62%}.cloud::after{width:30%;height:120%;left:50%;top:-40%}',
    '@keyframes drift{from{left:-25%}to{left:112%}}',
    '.fx{position:absolute;inset:0;overflow:hidden}',
    '.fx i{position:absolute;top:-30px;width:1.5px;height:16px;background:linear-gradient(rgba(255,255,255,0),var(--rain));animation:fall linear infinite;transform:rotate(12deg)}',
    '.fx.snow i{width:5px;height:5px;border-radius:50%;background:#fff;opacity:.85;animation-name:snowfall}',
    '@keyframes fall{to{transform:translate(-60px,1200px) rotate(12deg)}}',
    '@keyframes snowfall{0%{transform:translate(0,0)}50%{transform:translate(26px,600px)}100%{transform:translate(-10px,1200px)}}',
    '.fx.fog{background:linear-gradient(rgba(220,225,235,.0),rgba(220,225,235,.35) 60%,rgba(220,225,235,.0))}',
    '.fx.flash{animation:flash 7s infinite}',
    '@keyframes flash{0%,93%,97%,100%{background:transparent}94%,96%{background:rgba(255,255,255,.28)}}',
    /* header */
    '.hdr{position:relative;z-index:4;display:flex;align-items:center;gap:10px;padding:12px 14px 4px;flex-wrap:wrap}',
    '.ttl{font-weight:800;font-size:21px;letter-spacing:-.015em;line-height:1.05}',
    '.ttl small{display:block;font-weight:600;font-size:12px;opacity:.78;letter-spacing:0;margin-top:2px}',
    '.pill{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:700;background:var(--glass);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}',
    '.people{margin-left:auto;display:flex;gap:9px;padding-right:2px}',
    '.pp{position:relative;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:14px;background:var(--glass);filter:grayscale(1) opacity(.55);transition:filter .5s}',
    '.pp img{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover}',
    '.pp i{position:absolute;inset:-3px;border-radius:50%;border:2px solid transparent;transition:border-color .5s}',
    '.pp.home{filter:none}.pp.home i{border-color:#4ade80}',
    '.pp.active{filter:drop-shadow(0 0 9px #4ade80)}',
    '.pp.active i{animation:ping 1.7s ease-out infinite}',
    '@keyframes ping{0%{box-shadow:0 0 0 0 rgba(74,222,128,.75)}100%{box-shadow:0 0 0 15px rgba(74,222,128,0)}}',
    /* content + pages */
    '.content{position:relative;flex:1;min-height:0;z-index:2}',
    '.page{position:absolute;inset:0;display:none;overflow:auto;-webkit-overflow-scrolling:touch}',
    '.page.on{display:block}',
    '.page.home{overflow:hidden}',
    '.scene{position:absolute;left:0;right:0;top:0;bottom:62px}',
    '.scene svg{width:100%;height:100%;display:block;overflow:visible}',
    '.floors{position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px;z-index:3}',
    '.fb{position:relative;min-width:34px;padding:7px 10px;border-radius:12px;font-size:12px;font-weight:800;background:var(--glass);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}',
    '.fb.on{background:var(--fg);color:var(--sheet)}',
    '.fb u{position:absolute;right:-3px;top:-3px;width:10px;height:10px;border-radius:50%;background:#4ade80;animation:ping 1.7s ease-out infinite}',
    '.glance{position:absolute;left:0;right:0;bottom:8px;display:flex;gap:8px;padding:0 12px;overflow-x:auto;z-index:3;scrollbar-width:none}',
    '.glance::-webkit-scrollbar{display:none}',
    '.chip{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 13px;border-radius:16px;background:var(--glass);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-size:12px;line-height:1.15;text-align:left}',
    '.chip b{display:block;font-size:15px;font-weight:800}',
    '.chip span.e{font-size:20px}',
    '.chip.live{box-shadow:0 0 0 2px rgba(255,200,100,.6)}',
    '.chip.mode.on{background:var(--fg);color:var(--sheet)}',
    '.err,.hint{position:absolute;left:14px;right:14px;top:14px;padding:12px 14px;border-radius:14px;font-size:13px;line-height:1.4;z-index:5;background:var(--glass);backdrop-filter:blur(10px)}',
    '.err{border:2px solid #ff6b6b}',
    '.err code,.hint code,.panel code{font-family:ui-monospace,Menlo,monospace;font-size:12px;background:rgba(127,127,127,.18);padding:1px 5px;border-radius:5px}',
    /* panels */
    '.panel{padding:6px 14px 76px}',
    '.glasscard{background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:20px;padding:14px;margin-bottom:12px}',
    '.glasscard h3{margin:0 0 10px;font-size:14px;font-weight:800;display:flex;justify-content:space-between;align-items:baseline}',
    '.glasscard h3 small{font-weight:600;opacity:.7;font-size:12px}',
    '.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px}',
    '.tile{background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:18px;padding:12px 14px}',
    '.tile small{display:block;font-size:12px;font-weight:700;opacity:.75}',
    '.tile b{display:block;font-size:22px;font-weight:800;margin-top:2px;letter-spacing:-.01em}',
    '.tile em{font-style:normal;font-size:12px;opacity:.7}',
    '.flow{width:100%;height:auto;display:block}',
    '.flow text{fill:var(--fg);font-family:inherit}',
    '.flow .nv{font-size:15px;font-weight:800}.flow .nl{font-size:12px;font-weight:700;opacity:.75}',
    '.flow .ring{fill:var(--glass);stroke:rgba(127,127,127,.35);stroke-width:2}',
    '.fl{fill:none;stroke:rgba(127,127,127,.28);stroke-width:4;stroke-linecap:round}',
    '.fa{fill:none;stroke-width:5;stroke-linecap:round;stroke-dasharray:2 16;opacity:0;transition:opacity .5s}',
    '.fa.on{opacity:1;animation:dash 1.5s linear infinite}',
    '.fa.rev{animation-direction:reverse}',
    '@keyframes dash{to{stroke-dashoffset:-36}}',
    '.node.act .ring{stroke:var(--nc);filter:drop-shadow(0 0 8px var(--nc))}',
    '.bars{display:flex;align-items:flex-end;gap:3px;height:96px;padding-top:6px}',
    '.bars .b{position:relative;flex:1;height:100%;display:flex;align-items:flex-end;justify-content:center}',
    '.bars .b i{display:block;width:100%;min-height:2px;border-radius:5px 5px 2px 2px;background:var(--c);opacity:.9}',
    '.bars .b em{position:absolute;bottom:-17px;font-style:normal;font-size:10px;opacity:.7;white-space:nowrap}',
    '.bars.pad{margin-bottom:20px}',
    '.row2{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px}',
    '.toplist .tl{display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin:8px 0;font-size:13px;font-weight:700}',
    '.toplist .tl div{grid-column:1/-1;height:6px;border-radius:4px;background:rgba(127,127,127,.2);overflow:hidden}',
    '.toplist .tl div i{display:block;height:100%;background:#6ab8ff}',
    '.mut{opacity:.7;font-size:12px}',
    /* climate + security cards */
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:12px}',
    '.rc{background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:18px;padding:12px 14px;border-left:5px solid var(--tc,#888)}',
    '.rc small{font-size:12px;font-weight:700;opacity:.75;display:block}',
    '.rc b{font-size:26px;font-weight:800;letter-spacing:-.02em}',
    '.rc em{font-style:normal;font-size:12px;opacity:.75;margin-left:6px}',
    '.stepper{display:flex;align-items:center;gap:8px;margin-top:6px}',
    '.stepper button,.sq{width:30px;height:30px;border-radius:10px;background:rgba(127,127,127,.2);font-weight:800;font-size:16px}',
    '.item{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid rgba(127,127,127,.18);font-size:14px;font-weight:700}',
    '.item:last-child{border:0}',
    '.item .e{font-size:20px}.item .s{margin-left:auto;font-size:12px;font-weight:800;padding:3px 10px;border-radius:999px;background:rgba(74,222,128,.25)}',
    '.item.bad .s{background:rgba(255,107,107,.3);animation:ping 1.7s ease-out infinite;box-shadow:0 0 0 0 rgba(255,107,107,.6)}',
    /* tabs */
    '.tabs{position:relative;z-index:4;display:flex;justify-content:space-around;margin:0 12px 12px;padding:6px;border-radius:22px;background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}',
    '.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 4px;border-radius:16px;font-size:11px;font-weight:800;transition:background .3s}',
    '.tab span{font-size:20px;line-height:1.1}',
    '.tab.on{background:var(--fg);color:var(--sheet)}',
    /* sheet */
    '.scrim{position:absolute;inset:0;z-index:6;background:rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity .3s}',
    '.scrim.on{opacity:1;pointer-events:auto}',
    '.sheet{position:absolute;left:0;right:0;bottom:0;z-index:7;max-height:78%;overflow:auto;background:var(--sheet);color:var(--fg);border-radius:24px 24px 0 0;padding:8px 16px 22px;transform:translateY(105%);transition:transform .38s cubic-bezier(.2,.8,.2,1);box-shadow:0 -10px 40px rgba(0,0,0,.28)}',
    '.sheet.on{transform:none}',
    '.grab{width:44px;height:5px;border-radius:3px;background:rgba(127,127,127,.4);margin:2px auto 10px}',
    '.sh-h{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
    '.sh-h h2{margin:0;font-size:20px;font-weight:800;letter-spacing:-.01em}',
    '.sh-h .mut{margin-left:2px}',
    '.sh-h .x{margin-left:auto;width:34px;height:34px;border-radius:50%;background:rgba(127,127,127,.2);font-size:16px;font-weight:800}',
    '.sh-sec{margin:14px 0 4px;font-size:13px;font-weight:800;opacity:.7}',
    '.dr{display:grid;grid-template-columns:44px 1fr auto auto;align-items:center;gap:6px 10px;padding:8px 0;border-bottom:1px solid rgba(127,127,127,.16)}',
    '.dr:last-child{border:0}',
    '.dr .ic{width:44px;height:44px;border-radius:14px;background:rgba(127,127,127,.18);font-size:22px;transition:background .3s,box-shadow .3s}',
    '.dr.on .ic{background:var(--ac,#ffc566);box-shadow:0 0 16px var(--ac,#ffc566)}',
    '.dr .nm b{display:block;font-size:14px;font-weight:800;line-height:1.2}',
    '.dr .nm span{font-size:12px;opacity:.7}',
    '.dr .info{width:28px;height:28px;border-radius:50%;background:rgba(127,127,127,.15);font-size:13px;font-weight:800}',
    '.dr .ctl{display:flex;gap:6px;align-items:center}',
    '.dr .sl{grid-column:2/-1;width:100%;accent-color:var(--ac,#ffc566)}',
    '.dr .stepper{margin:0}',
    '.sens{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 0}',
    '.sens span{font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(127,127,127,.18)}',
    '.sens span.hot{background:rgba(74,222,128,.3)}',
    '.sens span.bad{background:rgba(255,107,107,.3)}',
    /* svg parts */
    'svg text{font-family:inherit}',
    'svg .floor{stroke:var(--edge);stroke-width:1;transition:fill .9s}',
    'svg .wN,svg .wW,svg .lowF{stroke:var(--edge);stroke-width:.8;transition:fill .9s}',
    'svg .cap{stroke:var(--edge);stroke-width:.6;transition:fill .9s}',
    'svg .win{stroke:rgba(255,255,255,.6);stroke-width:1.3;transition:fill .9s}',
    'svg .mull{stroke:rgba(255,255,255,.6);stroke-width:1}',
    'svg .base{transition:fill .9s}',
    'svg .room{cursor:pointer}',
    'svg .room:hover .floor{stroke:var(--fg);stroke-width:1.6}',
    'svg .lbl{font-weight:800;fill:var(--lbl);paint-order:stroke;stroke:var(--halo);stroke-width:3px;stroke-linejoin:round;pointer-events:none}',
    'svg .tmp{font-weight:700;fill:var(--lbl);paint-order:stroke;stroke:var(--halo);stroke-width:3px;stroke-linejoin:round;pointer-events:none;opacity:.85}',
    'svg .glow{opacity:0;transition:opacity .9s}',
    'svg .glow.tv{animation:flick 3.1s infinite}',
    '@keyframes flick{0%,100%{filter:brightness(1)}12%{filter:brightness(.78)}30%{filter:brightness(1.12)}48%{filter:brightness(.85)}63%{filter:brightness(1.05)}80%{filter:brightness(.8)}}',
    'svg .wash{pointer-events:none}',
    'svg .presence{fill:none;stroke:#4ade80;stroke-width:3;opacity:0;pointer-events:none;transition:opacity .6s}',
    'svg .presence.on{opacity:1;animation:presence 2s ease-in-out infinite}',
    '@keyframes presence{0%,100%{stroke-opacity:.9}50%{stroke-opacity:.25}}',
    'svg .dev{cursor:pointer}',
    'svg .dev .shadow{fill:rgba(0,0,0,.22);transition:fill .5s}',
    'svg .dev .ring{fill:none;stroke:var(--c,#ffc566);stroke-width:2.2;opacity:0;transform-box:fill-box;transform-origin:center}',
    'svg .dev .ico{filter:grayscale(1) opacity(.6);transition:filter .5s}',
    'svg .dev .emo{font-size:19px}',
    'svg .dev.on .shadow{fill:var(--c,#ffc566);fill-opacity:.55}',
    'svg .dev.on .ring{opacity:.95;animation:ringpulse 2.4s ease-in-out infinite}',
    'svg .dev.on .ico{filter:drop-shadow(0 0 6px var(--c,#ffc566))}',
    'svg .dev.on .bob{animation:bob 2.2s ease-in-out infinite}',
    'svg .dev.na{opacity:.35}',
    '@keyframes ringpulse{0%,100%{transform:scale(1);opacity:.95}50%{transform:scale(1.28);opacity:.3}}',
    '@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
    'svg .av{opacity:0;pointer-events:none;transition:transform 1.8s cubic-bezier(.4,0,.2,1),opacity .6s}',
    'svg .av.on{opacity:1}',
    'svg .av .disc{fill:#27364f;stroke:#fff;stroke-width:2}',
    'svg .av.generic .disc{fill:#52627f}',
    'svg .av .ini{fill:#fff;font-size:11px;font-weight:800}',
    'svg .av .halo{fill:none;stroke:#4ade80;stroke-width:2.2;opacity:0;transform-box:fill-box;transform-origin:center}',
    'svg .av.detected .halo{animation:halo 1.9s ease-out infinite}',
    'svg .av.detected .halo.b{animation-delay:.95s}',
    '@keyframes halo{0%{transform:scale(.45);opacity:.95}100%{transform:scale(2.3);opacity:0}}',
    'svg .av .body{animation:avbob 2.1s ease-in-out infinite}',
    'svg .av.detected .body{filter:drop-shadow(0 0 8px #4ade80)}',
    'svg .av.detected .ring2{stroke:#4ade80}',
    'svg .av .ring2{fill:none;stroke:#fff;stroke-width:2}',
    '@keyframes avbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}',
    '@media (prefers-reduced-motion:reduce){.cloud,.fx i,.star,svg .dev.on .bob,svg .av .body{animation:none!important}}',
    '.card.noanim *{animation:none!important}',
    '@media (max-width:520px){.ttl{font-size:18px}.pp{width:34px;height:34px}.tab{font-size:10px}.floors{top:4px;left:10px;transform:none;flex-direction:row-reverse;justify-content:flex-end}.scene{top:34px}}'
  ].join('\n');

  /* ======================================================================
   * The card
   * ==================================================================== */
  var TABS = {
    home: { e: '🏠', l: 'Home' }, energy: { e: '⚡', l: 'Energy' },
    climate: { e: '🌡️', l: 'Climate' }, security: { e: '🛡️', l: 'Security' }
  };
  var WX = {
    'clear-night': '🌙', cloudy: '☁️', exceptional: '⚠️', fog: '🌫️', hail: '🌨️', lightning: '🌩️', 'lightning-rainy': '⛈️',
    partlycloudy: '⛅', pouring: '🌧️', rainy: '🌦️', snowy: '❄️', 'snowy-rainy': '🌨️', sunny: '☀️', windy: '💨', 'windy-variant': '💨'
  };

  class SweetFloorCard extends HTMLElement {
    constructor() {
      super();
      this._uid = Math.random().toString(36).slice(2, 7);
      this._tab = 'home'; this._floor = null; this._sheet = null; this._built = false; this._sk = false;
      this._rs = {}; this._timers = [];
      this.attachShadow({ mode: 'open' });
    }

    static getStubConfig() { return { title: 'Home' }; }

    setConfig(config) {
      if (!config || typeof config !== 'object') throw new Error('sweet-floor-card: invalid configuration');
      this._config = Object.assign({ title: 'Home', linger: 90, animations: true, tabs: ['home', 'energy', 'climate', 'security'] }, config);
      this._config.tabs = (this._config.tabs || []).filter(function (t) { return TABS[t]; });
      if (!this._config.tabs.length) this._config.tabs = ['home'];
      if (this._config.tabs.indexOf(this._tab) < 0) this._tab = this._config.tabs[0];
      this._built = false; this._sk = false; this._mk = null;
      if (this._hass) { try { this._onHass(); } catch (e) { this._fail(e); } }
    }

    set hass(hass) {
      var self = this;
      this._hass = hass;
      if (!this._registries) {
        if (window.__ha_registries) {
          this._registries = window.__ha_registries;
        } else if (hass && typeof hass.callWS === 'function' && !this._fetchingReg) {
          this._fetchingReg = true;
          fetchRegistries(hass).then(function (regs) {
            self._fetchingReg = false;
            if (regs && (Object.keys(regs.areas).length > 0 || Object.keys(regs.entities).length > 0)) {
              self._registries = window.__ha_registries = regs;
              if (self._built) {
                self._built = false;
                self._init();
              }
            }
          }).catch(function () { self._fetchingReg = false; });
        }
      }
      try { this._onHass(); } catch (e) { this._fail(e); }
    }
    get hass() { return this._hass; }

    getCardSize() { return 10; }
    getGridOptions() { return { columns: 12, rows: 9, min_columns: 6, min_rows: 6 }; }
    getLayoutOptions() { return { grid_columns: 4, grid_rows: 7 }; }

    connectedCallback() {
      var self = this;
      this._disconnect();
      if (!this._registries && this._hass && typeof this._hass.callWS === 'function' && !this._fetchingReg) {
        this._fetchingReg = true;
        fetchRegistries(this._hass).then(function (regs) {
          self._fetchingReg = false;
          if (regs && (Object.keys(regs.areas).length > 0 || Object.keys(regs.entities).length > 0)) {
            self._registries = window.__ha_registries = regs;
            if (self._built) {
              self._built = false;
              self._init();
            }
          }
        }).catch(function () { self._fetchingReg = false; });
      }
      this._timers.push(setInterval(function () {
        if (!self._hass || !self._built) return;
        try { self._update(); } catch (e) { self._fail(e); }
      }, 10000));
      this._timers.push(setInterval(function () { self._loadEnergy(true); }, 300000));
    }
    disconnectedCallback() { this._disconnect(); }
    _disconnect() { this._timers.forEach(clearInterval); this._timers = []; }

    $(sel) { return this.shadowRoot.querySelector(sel); }

    /* ---------------------------------------------------------------- errors */
    _fail(e) {
      console.error('[sweet-floor-card]', e);
      try {
        if (!this._sk) { this.shadowRoot.innerHTML = '<style>' + STYLE + '</style><ha-card><div class="card"><div class="err"></div></div></ha-card>'; }
        var box = this.$('.err');
        if (!box) { box = document.createElement('div'); box.className = 'err'; (this.$('.card') || this.shadowRoot).appendChild(box); }
        box.innerHTML = '<b>Sweet Floor Card hit a problem.</b><br>' + esc((e && e.message) || e) + '<br><span class="mut">Details are in the browser console (F12).</span>';
      } catch (e2) { /* nothing else we can do */ }
    }

    /* ----------------------------------------------------------- hass entry */
    _onHass() {
      var hass = this._hass;
      if (!hass || !this._config) return;
      if (!this._built || this._modelChanged()) { this._init(); return; }
      if (this._relevantChanged()) this._update();
    }

    _modelChanged() {
      var h = this._hass, k = this._mk;
      if (!k) return true;
      if (k.n !== Object.keys(h.states).length) return true;
      var regs = this._registries || window.__ha_registries || {};
      var cur = [regs.entities || h.entities, regs.areas || h.areas, regs.devices || h.devices, regs.floors || h.floors];
      for (var i = 0; i < 4; i++) if (k.o[i] !== cur[i]) return true;
      return false;
    }

    _relevantChanged() {
      var S = this._hass.states, ids = this._relevant || [], snap = this._snap || [], ch = false;
      for (var i = 0; i < ids.length; i++) if (S[ids[i]] !== snap[i]) { ch = true; break; }
      return ch;
    }

    _collectRelevant() {
      var S = this._hass.states, cfg = this._config, set = {};
      var add = function (id) { if (id && typeof id === 'string') set[id] = 1; };
      add(cfg.sun_entity || 'sun.sun'); add(this._wxId);
      (this._persons || []).forEach(function (p) { add(p.entity); add(p.area_sensor); });
      this._model.rooms.forEach(function (r) {
        r.devs.forEach(function (d) { add(d.id); });
        r.motion.concat(r.openings, r.alarms).forEach(add); add(r.temp); add(r.hum);
      });
      (this._sec || []).forEach(add); (this._thermo || []).forEach(add);
      (cfg.modes || []).forEach(function (m) { add(typeof m === 'string' ? m : m.entity); });
      if (this._en && this._en.src) {
        var src = this._en.src;
        [src.grid.power, src.solar.power, src.battery.power].forEach(function (l) { l.forEach(function (r) { add(r.id); }); });
        add(src.home);
        src.gas.energy.concat(src.grid.from, src.solar.energy).forEach(add);
      }
      this._relevant = Object.keys(set);
      this._snap = this._relevant.map(function (id) { return S[id]; });
    }

    /* ----------------------------------------------------------------- init */
    _init() {
      var hass = this._hass, cfg = this._config;
      var regs = this._registries || window.__ha_registries || {};
      this._mk = { n: Object.keys(hass.states).length, o: [regs.entities || hass.entities, regs.areas || hass.areas, regs.devices || hass.devices, regs.floors || hass.floors] };
      this._model = buildModel(hass, cfg, this._registries);

      // persons
      var pl = cfg.persons;
      if (!Array.isArray(pl)) pl = Object.keys(hass.states).filter(function (id) { return domainOf(id) === 'person'; }).slice(0, 6);
      this._persons = pl.map(function (p) { return typeof p === 'string' ? { entity: p } : p; })
        .filter(function (p) { return p && p.entity && hass.states[p.entity]; });

      // weather
      this._wxId = cfg.weather || Object.keys(hass.states).filter(function (id) { return domainOf(id) === 'weather'; })[0] || null;

      // security + thermostat lists (whole house, not only rooms)
      var sec = [], thermo = [];
      Object.keys(hass.states).forEach(function (id) {
        var s = hass.states[id], dom = domainOf(id), dc = s.attributes && s.attributes.device_class;
        if (dom === 'alarm_control_panel' || dom === 'lock') sec.push(id);
        else if (dom === 'binary_sensor' && ['door', 'window', 'garage_door', 'opening', 'smoke', 'gas', 'carbon_monoxide', 'moisture', 'safety'].indexOf(dc) >= 0) sec.push(id);
        else if (dom === 'climate') thermo.push(id);
      });
      this._sec = sec; this._thermo = thermo;

      // floor selection
      var fl = this._model.floors;
      if (!this._floor || !fl.some(function (f) { return f.id === this._floor; }, this)) {
        var def = fl.filter(function (f) { return f.level === 0; })[0] || fl[0];
        this._floor = def ? def.id : null;
      }

      this._skeleton();
      this._buildStars();
      this._buildHeader();
      this._buildTabs();
      this._buildFloors();
      this._buildScene();
      this._collectRelevant();
      this._built = true;
      this._update();
      if (!this._en && !this._enLoading) this._loadEnergy(true);
    }

    _skeleton() {
      if (this._sk) return;
      var self = this, cfg = this._config;
      var h = cfg.height ? (typeof cfg.height === 'number' ? cfg.height + 'px' : cfg.height) : null;
      this.shadowRoot.innerHTML = '<style>' + STYLE + '</style>' +
        '<ha-card><div class="card' + (cfg.animations === false ? ' noanim' : '') + '"' + (h ? ' style="--h:' + h + '"' : '') + '>' +
        '<div class="sky"><div class="stars"></div><div class="arc"></div><div class="clouds"></div><div class="sun"></div><div class="moon"></div><div class="fx"></div></div>' +
        '<div class="hdr"></div>' +
        '<div class="content">' +
        '<section class="page home on"><div class="scene"></div><div class="floors"></div><div class="glance"></div></section>' +
        '<section class="page energy"><div class="panel"></div></section>' +
        '<section class="page climate"><div class="panel"></div></section>' +
        '<section class="page security"><div class="panel"></div></section>' +
        '</div>' +
        '<nav class="tabs"></nav>' +
        '<div class="scrim" data-act="close"></div><div class="sheet"></div>' +
        '</div></ha-card>';
      this._sk = true;

      var card = this.$('.card');
      card.addEventListener('click', function (e) {
        if (self._lp) { self._lp = false; return; }
        var t = e.target;
        var a = t.closest && t.closest('[data-act]');
        if (a) { self._act(a); return; }
        var dev = t.closest && t.closest('.dev');
        if (dev) { var d = self._sc && self._sc.devs[+dev.getAttribute('data-di')]; if (d) self._toggle(d.id); return; }
        var rm = t.closest && t.closest('.room');
        if (rm) { var r = self._sc && self._sc.rooms[+rm.getAttribute('data-ri')]; if (r) self._openSheet(r.room.id); }
      });
      card.addEventListener('pointerdown', function (e) {
        var dev = e.target.closest && e.target.closest('.dev');
        var row = e.target.closest && e.target.closest('.rc[data-id],.item[data-id]');
        var tgt = dev ? (self._sc && self._sc.devs[+dev.getAttribute('data-di')]) : (row && row.getAttribute('data-id') ? { id: row.getAttribute('data-id') } : null);
        if (!tgt) return;
        clearTimeout(self._lpT);
        self._lpT = setTimeout(function () { self._lp = true; self._more(tgt.id); }, 550);
      });
      var clr = function () { clearTimeout(self._lpT); };
      ['pointerup', 'pointercancel', 'pointerleave', 'pointermove'].forEach(function (ev) { card.addEventListener(ev, clr); });
      card.addEventListener('change', function (e) {
        var t = e.target;
        if (t.matches && t.matches('input[data-bri]')) {
          self._busy = false;
          self._hass.callService('light', 'turn_on', { entity_id: t.getAttribute('data-bri'), brightness_pct: +t.value });
        }
      });
      card.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('input[data-bri]')) self._busy = true; });
    }

    _buildStars() {
      var st = this.$('.stars'), h = '';
      var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (var i = 0; i < 46; i++) {
        h += '<i class="star" style="left:' + (rnd() * 100).toFixed(1) + '%;top:' + (rnd() * 52).toFixed(1) + '%;animation-delay:' + (rnd() * 4).toFixed(1) + 's;' +
          (rnd() > 0.85 ? 'width:3px;height:3px' : '') + '"></i>';
      }
      st.innerHTML = h;
      var cl = '', specs = [[14, 70, 62, 0.9], [9, 110, 80, 0.7], [26, 90, 95, 0.8]];
      specs.forEach(function (s, i) {
        cl += '<div class="cloud" style="top:' + s[0] + '%;width:' + s[1] + 'px;animation-duration:' + s[2] + 's;animation-delay:-' + (i * 23) + 's"></div>';
      });
      this.$('.clouds').innerHTML = cl;
    }

    _buildHeader() {
      var cfg = this._config;
      var h = '<div class="ttl">' + esc(cfg.title) + '<small class="sub"></small></div><div class="pill wx" style="display:none"></div><div class="people">';
      this._persons.forEach(function (p, i) { h += '<div class="pp" data-p="' + i + '" title=""><span class="pi"></span><i></i></div>'; });
      h += '</div>';
      this.$('.hdr').innerHTML = h;
      var self = this;
      this._persons.forEach(function (p, i) {
        var el = self.$('.pp[data-p="' + i + '"]'), s = self._hass.states[p.entity];
        var name = p.name || (s.attributes && s.attributes.friendly_name) || p.entity;
        el.title = name;
        el.querySelector('.pi').textContent = name.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
        var pic = p.picture || (s.attributes && s.attributes.entity_picture);
        if (pic) {
          var img = document.createElement('img'); img.src = pic; img.alt = '';
          img.onerror = function () { img.remove(); };
          el.insertBefore(img, el.firstChild);
        }
        el.setAttribute('data-act', 'more'); el.setAttribute('data-id', p.entity);
      });
    }

    _buildTabs() {
      var tabs = this._config.tabs;
      this.$('.tabs').innerHTML = tabs.map(function (t) {
        return '<button class="tab" data-act="tab" data-v="' + t + '"><span>' + TABS[t].e + '</span>' + TABS[t].l + '</button>';
      }).join('');
      this.$('.tabs').style.display = tabs.length > 1 ? '' : 'none';
      this._setTab(this._tab, true);
    }

    _setTab(t, quiet) {
      if (this._config.tabs.indexOf(t) < 0) t = this._config.tabs[0];
      this._tab = t;
      var self = this;
      ['home', 'energy', 'climate', 'security'].forEach(function (n) { setC(self.$('.page.' + n), 'on', n === t); });
      this.shadowRoot.querySelectorAll('.tab').forEach(function (b) { setC(b, 'on', b.getAttribute('data-v') === t); });
      if (!quiet) { this._update(); if (t === 'energy') this._loadEnergy(false); }
    }

    _buildFloors() {
      var fl = this._model.floors, box = this.$('.floors'), self = this;
      if (fl.length < 2) { box.innerHTML = ''; return; }
      box.innerHTML = fl.slice().reverse().map(function (f) {
        return '<button class="fb' + (f.id === self._floor ? ' on' : '') + '" data-act="floor" data-v="' + esc(f.id) + '">' + esc(f.name) + '<u style="display:none"></u></button>';
      }).join('');
    }

    /* ---------------------------------------------------------------- scene */
    _buildScene() {
      var model = this._model, fl = model.floors.filter(function (f) { return f.id === this._floor; }, this)[0];
      var wrap = this.$('.scene');
      if (!fl) {
        wrap.innerHTML = '';
        return;
      }
      var uid = this._uid, rooms = fl.rooms.slice();
      var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      rooms.forEach(function (r) { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x1); maxY = Math.max(maxY, r.y1); });
      var m = 0.7;
      var bx0 = minX - m, by0 = minY - m, bx1 = maxX + m, by1 = maxY + m;
      var sx0 = iso(bx0, by1, 0)[0], sx1 = iso(bx1, by0, 0)[0];
      var sy0 = iso(bx0, by0, WALL_H)[1], sy1 = iso(bx1, by1, -16)[1];
      var pad = 14, vx = sx0 - pad, vy = sy0 - pad - 6, vw = (sx1 - sx0) + pad * 2, vh = (sy1 - sy0) + pad * 2 + 6;
      var fs = Math.max(10.5, vw / 52);

      var defs = '<linearGradient id="sw-' + uid + '" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0c0" stop-opacity="0"/><stop offset=".8" stop-color="#fff0c0" stop-opacity="0"/></linearGradient>';
      var body = '';
      var devs = [], gi = 0;

      // platform
      body += poly([[bx0, by0, 0], [bx1, by0, 0], [bx1, by1, 0], [bx0, by1, 0]], 'class="base top"');
      body += poly([[bx0, by1, 0], [bx1, by1, 0], [bx1, by1, -16], [bx0, by1, -16]], 'class="base sideA"');
      body += poly([[bx1, by0, 0], [bx1, by1, 0], [bx1, by1, -16], [bx1, by0, -16]], 'class="base sideB"');

      rooms.sort(function (a, b) { return (a.x + a.y + a.w + a.h) - (b.x + b.y + b.w + b.h) || a.y - b.y; });
      var order = rooms.slice();
      var all = fl.rooms;
      order.forEach(function (r, ri) {
        var x = r.x, y = r.y, x1 = r.x1, y1 = r.y1;
        var nbN = neighbor(r, 'n', all), nbW = neighbor(r, 'w', all);
        var hN = nbN ? LOW_H : WALL_H, hW = nbW ? LOW_H : WALL_H;
        var floorPts = [[x, y, 0], [x1, y, 0], [x1, y1, 0], [x, y1, 0]];
        var g = '<g class="room" data-ri="' + ri + '">';
        g += '<clipPath id="rc-' + uid + '-' + ri + '">' + poly(floorPts, '') + '</clipPath>';
        g += poly(floorPts, 'class="floor"');
        g += poly(floorPts, 'class="wash" fill="url(#sw-' + uid + ')"');
        // glows (clipped to the room)
        g += '<g clip-path="url(#rc-' + uid + '-' + ri + ')">';
        var cnt = r.puck.length, positions = [];
        for (var i = 0; i < cnt; i++) {
          positions.push(devPos(r, i, cnt));
        }
        r.puck.forEach(function (d, i) {
          if (d.kind !== 'light' && d.kind !== 'tv') { d._gi = -1; return; }
          var c = iso(positions[i][0], positions[i][1], 0);
          defs += '<radialGradient id="gg-' + uid + '-' + gi + '"><stop offset="0" stop-color="#ffd696" stop-opacity=".85"/><stop offset=".5" stop-color="#ffd696" stop-opacity=".32"/><stop offset="1" stop-color="#ffd696" stop-opacity="0"/></radialGradient>';
          g += '<ellipse class="glow ' + d.kind + '" data-gi="' + gi + '" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" rx="60" ry="30" fill="url(#gg-' + uid + '-' + gi + ')"/>';
          d._gi = gi; gi++;
        });
        g += '</g>';
        g += poly([[x + 0.12, y + 0.12, 0], [x1 - 0.12, y + 0.12, 0], [x1 - 0.12, y1 - 0.12, 0], [x + 0.12, y1 - 0.12, 0]], 'class="presence"');
        // back walls
        g += poly([[x, y, 0], [x1, y, 0], [x1, y, hN], [x, y, hN]], 'class="wN"');
        g += poly([[x, y - WT, hN], [x1, y - WT, hN], [x1, y, hN], [x, y, hN]], 'class="cap"');
        g += poly([[x, y, 0], [x, y1, 0], [x, y1, hW], [x, y, hW]], 'class="wW"');
        g += poly([[x - WT, y, hW], [x, y, hW], [x, y1, hW], [x - WT, y1, hW]], 'class="cap"');
        // windows on tall walls
        var wins = '';
        if (!nbN && r.w >= 2.6) {
          [[0.14, 0.4], [0.6, 0.86]].forEach(function (p) {
            var a = x + r.w * p[0], b = x + r.w * p[1];
            wins += poly([[a, y, 17], [b, y, 17], [b, y, 40], [a, y, 40]], 'class="win"');
            var mx = (a + b) / 2;
            wins += '<line class="mull" x1="' + iso(mx, y, 17)[0].toFixed(1) + '" y1="' + iso(mx, y, 17)[1].toFixed(1) + '" x2="' + iso(mx, y, 40)[0].toFixed(1) + '" y2="' + iso(mx, y, 40)[1].toFixed(1) + '"/>';
          });
        }
        if (!nbW && r.h >= 2.6) {
          [[0.2, 0.8]].forEach(function (p) {
            var a = y + r.h * p[0], b = y + r.h * p[1];
            wins += poly([[x, a, 17], [x, b, 17], [x, b, 40], [x, a, 40]], 'class="win"');
          });
        }
        g += wins;
        // low front walls
        g += poly([[x, y1 + WT, 0], [x1 + WT, y1 + WT, 0], [x1 + WT, y1 + WT, LOW_H], [x, y1 + WT, LOW_H]], 'class="lowF"');
        g += poly([[x, y1, LOW_H], [x1 + WT, y1, LOW_H], [x1 + WT, y1 + WT, LOW_H], [x, y1 + WT, LOW_H]], 'class="cap"');
        g += poly([[x1 + WT, y, 0], [x1 + WT, y1 + WT, 0], [x1 + WT, y1 + WT, LOW_H], [x1 + WT, y, LOW_H]], 'class="lowF"');
        g += poly([[x1, y, LOW_H], [x1 + WT, y, LOW_H], [x1 + WT, y1 + WT, LOW_H], [x1, y1 + WT, LOW_H]], 'class="cap"');
        // label
        var lp = iso(x + 0.3, y1 - 0.28, 0);
        g += '<text class="lbl" x="' + lp[0].toFixed(1) + '" y="' + lp[1].toFixed(1) + '" style="font-size:' + fs.toFixed(1) + 'px">' + esc(r.name) + '</text>';
        g += '<text class="tmp" x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + fs * 1.05).toFixed(1) + '" style="font-size:' + (fs * 0.9).toFixed(1) + 'px"></text>';
        // devices, back to front
        var idx = r.puck.map(function (d, i) { return i; }).sort(function (a, b) { return (positions[a][0] + positions[a][1]) - (positions[b][0] + positions[b][1]); });
        idx.forEach(function (i) {
          var d = r.puck[i], p = iso(positions[i][0], positions[i][1], 0), di = devs.length;
          devs.push({ id: d.id, kind: d.kind, roomIdx: ri, gi: d._gi, pos: positions[i] });
          g += '<g class="dev" data-di="' + di + '" transform="translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"><title>' + esc(d.name) + '</title>' +
            '<ellipse class="shadow" rx="13" ry="6.5" cy="1"/><ellipse class="ring" rx="17" ry="8.5" cy="1"/>' +
            '<g class="ico"><g class="bob"><text class="emo" text-anchor="middle" y="-6">' + ICON[d.kind] + '</text></g></g></g>';
        });
        g += '</g>';
        body += g;
      });

      // avatars layer (people + generic occupants)
      var av = '';
      var self = this;
      var mk = function (key, label, pic, generic, n) {
        var a = '<g class="av' + (generic ? ' generic' : '') + '" data-key="' + esc(key) + '" style="transform:translate(0px,0px)">' +
          '<ellipse class="halo" rx="18" ry="9"/><ellipse class="halo b" rx="18" ry="9"/>' +
          '<g class="body"><circle class="disc" r="13" cy="-20"/>';
        if (generic || !label) a += '<circle cx="0" cy="-23" r="4" fill="#fff"/><path d="M-8 -11 a8 8 0 0 1 16 0z" fill="#fff"/>';
        else a += '<text class="ini" text-anchor="middle" y="-16">' + esc(label) + '</text>';
        if (pic) a += '<clipPath id="ac-' + uid + '-' + n + '"><circle r="12" cy="-20"/></clipPath><image href="' + esc(pic) + '" x="-12" y="-32" width="24" height="24" clip-path="url(#ac-' + uid + '-' + n + ')" preserveAspectRatio="xMidYMid slice"/>';
        a += '<circle class="ring2" r="13" cy="-20"/><path d="M-4 -8 L4 -8 L0 -1 Z" fill="#fff"/></g></g>';
        return a;
      };
      this._persons.forEach(function (p, i) {
        var s = self._hass.states[p.entity], name = p.name || (s.attributes && s.attributes.friendly_name) || p.entity;
        var ini = name.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
        av += mk(p.entity, ini, p.picture || (s.attributes && s.attributes.entity_picture), false, i);
      });
      for (var g2 = 0; g2 < 6; g2++) av += mk('generic-' + g2, '', null, true, 100 + g2);
      body += '<g class="avatars">' + av + '</g>';

      wrap.innerHTML = '<svg viewBox="' + [vx, vy, vw, vh].map(function (n) { return n.toFixed(1); }).join(' ') + '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><defs>' + defs + '</defs>' + body + '</svg>';

      // refs
      var svg = wrap.querySelector('svg');
      var sc = { svg: svg, rooms: [], devs: devs, glows: {}, avs: {}, vb: { x: vx, y: vy, w: vw, h: vh }, floorId: fl.id };
      order.forEach(function (r, ri) {
        var g = svg.querySelector('.room[data-ri="' + ri + '"]');
        sc.rooms.push({
          room: r, g: g, floor: g.querySelector('.floor'), wash: g.querySelector('.wash'),
          wN: g.querySelector('.wN'), wW: g.querySelector('.wW'), caps: g.querySelectorAll('.cap'), lows: g.querySelectorAll('.lowF'),
          wins: g.querySelectorAll('.win'), pres: g.querySelector('.presence'), tmp: g.querySelector('.tmp'), lbl: g.querySelector('.lbl')
        });
      });
      devs.forEach(function (d, di) {
        d.el = svg.querySelector('.dev[data-di="' + di + '"]');
        if (d.gi != null && d.gi >= 0) {
          d.glow = svg.querySelector('.glow[data-gi="' + d.gi + '"]');
          var gr = svg.querySelector('#gg-' + uid + '-' + d.gi);
          d.stops = gr ? gr.querySelectorAll('stop') : [];
        }
      });
      svg.querySelectorAll('.av').forEach(function (a) { sc.avs[a.getAttribute('data-key')] = { el: a, placed: false, room: null }; });
      sc.washGrad = svg.querySelector('#sw-' + uid);
      sc.base = svg.querySelectorAll('.base');
      this._sc = sc;
      this._rs = {};
    }

    /* --------------------------------------------------------------- update */
    _update() {
      if (!this._built) return;
      var hass = this._hass, S = hass.states, cfg = this._config, now = new Date();
      var env = this._env = computeEnv(hass, cfg, now);
      this._weather(S);
      this._applyEnv(env);

      // room state for ALL rooms (glance, presence, floor dots)
      var rs = this._rs = {}, linger = cfg.linger * 1000, nowMs = Date.now();
      this._model.rooms.forEach(function (r) {
        var glow = roomGlow(r.devs, S);
        var pr = { on: false, t: 0 };
        r.motion.forEach(function (id) {
          var s = S[id]; if (!s) return;
          var lc = Date.parse(s.last_changed) || 0;
          if (s.state === 'on') { pr.on = true; pr.t = Math.max(pr.t, lc); }
          else if (s.state === 'off' && lc && nowMs - lc < linger) { pr.on = true; pr.t = Math.max(pr.t, lc); }
        });
        var open = r.openings.filter(function (id) { return S[id] && S[id].state === 'on'; }).length;
        var alarm = r.alarms.filter(function (id) { return S[id] && S[id].state === 'on'; }).length;
        var t = r.temp && S[r.temp] ? num(S[r.temp].state) : null, tu = r.temp && S[r.temp] ? S[r.temp].attributes.unit_of_measurement : '';
        if (t == null) {
          var cl = r.devs.filter(function (d) { return d.kind === 'climate'; })[0];
          if (cl && S[cl.id]) { t = num(S[cl.id].attributes.current_temperature); tu = hass.config && hass.config.unit_system ? hass.config.unit_system.temperature : '°C'; }
        }
        var hu = r.hum && S[r.hum] ? num(S[r.hum].state) : null;
        rs[r.id] = { glow: glow, pres: pr, open: open, alarm: alarm, t: t, tu: tu, hu: hu };
      });

      this._updateScene(env);
      this._updateAvatars(S);
      this._updateHeader(S);
      this._updateGlance(S);
      this._updateFloors();
      if (this._tab === 'energy') this._renderEnergyLive();
      if (this._tab === 'climate') this._renderClimate(S);
      if (this._tab === 'security') this._renderSecurity(S);
      if (this._sheet && !this._busy) this._renderSheet();
      var hint = this.$('.hint');
      if (hint) hint.remove();
      if (this._model.rooms.length === 1 && this._model.rooms[0].fallback && this._tab === 'home') {
        var d = document.createElement('div'); d.className = 'hint';
        d.innerHTML = '<b>No areas found.</b> Create areas in <code>Settings → Areas</code> and assign your devices, or define <code>rooms:</code> in the card YAML.';
        this.$('.page.home').appendChild(d);
      }
      var errBox = this.$('.err'); if (errBox) errBox.remove();
    }

    _weather(S) {
      var el = this.$('.wx'), w = this._wxId && S[this._wxId];
      if (!w) { el.style.display = 'none'; this._wxState = null; return; }
      var cond = w.state, t = num(w.attributes.temperature), u = w.attributes.temperature_unit || '°C';
      el.style.display = '';
      var ic = WX[cond] || '🌡️';
      if (this._env && this._env.night > 0.7 && (cond === 'sunny' || cond === 'partlycloudy')) ic = cond === 'sunny' ? '🌙' : '☁️';
      setT(el, ic + ' ' + (t == null ? '' : Math.round(t) + u));
      el.title = String(cond).replace(/-/g, ' ');
      if (this._wxState !== cond) { this._wxState = cond; this._buildFx(cond); }
    }

    _buildFx(cond) {
      var fx = this.$('.fx'), n = 0, cls = 'fx';
      var rain = /rainy|pouring|lightning-rainy|hail/.test(cond), snow = /snowy/.test(cond);
      if (rain) n = cond === 'pouring' ? 46 : 28;
      if (snow) { n = 30; cls += ' snow'; }
      if (cond === 'fog') cls += ' fog';
      if (/lightning/.test(cond)) cls += ' flash';
      var h = '', seed = 11, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (var i = 0; i < n; i++) {
        h += '<i style="left:' + (rnd() * 110 - 5).toFixed(1) + '%;animation-duration:' + (snow ? 6 + rnd() * 6 : 0.7 + rnd() * 0.6).toFixed(2) + 's;animation-delay:-' + (rnd() * 6).toFixed(2) + 's"></i>';
      }
      fx.className = cls; fx.innerHTML = h;
      var cloudy = { sunny: 0.15, 'clear-night': 0.1, partlycloudy: 0.6, cloudy: 1, fog: 1, rainy: 1, pouring: 1, 'lightning-rainy': 1, lightning: 1, snowy: 1, 'snowy-rainy': 1, hail: 1, windy: 0.5 };
      this._cloud = cloudy[cond] != null ? cloudy[cond] : 0.35;
    }

    _applyEnv(env) {
      var card = this.$('.card'), cloud = this._cloud == null ? 0.35 : this._cloud;
      var grey = cloud * 0.55 * env.dayK;
      var top = mixA(env.skyTop, [120, 130, 146], grey), bot = mixA(env.skyBot, [168, 176, 190], grey);
      setS(card, '--sky-top', css(top)); setS(card, '--sky-bot', css(bot));
      setS(card, '--fg', css(env.fg)); setS(card, '--glass', css(env.glass, env.glassA.toFixed(2)));
      setS(card, '--sheet', css(env.sheet)); setS(card, '--lbl', css(env.pal.text)); setS(card, '--halo', css(env.pal.halo));
      setS(card, '--edge', css(env.pal.edge)); setS(card, '--sun', css(env.sunCol));
      setS(card, '--sun-glow', css(env.sunCol, 0.5));
      setS(card, '--cloud', css(mixA([95, 105, 145], [255, 255, 255], env.dayK), (0.28 + 0.6 * env.dayK).toFixed(2)));
      var sun = this.$('.sun'), moon = this.$('.moon'), stars = this.$('.stars'), arc = this.$('.arc');
      sun.style.left = env.sunX.toFixed(1) + '%'; sun.style.top = env.sunY.toFixed(1) + '%';
      setS(sun, 'opacity', env.sunVis.toFixed(2));
      moon.style.left = env.moonX.toFixed(1) + '%'; moon.style.top = env.moonY.toFixed(1) + '%';
      setS(moon, 'opacity', (env.moonVis * (1 - cloud * 0.5)).toFixed(2));
      setS(stars, 'opacity', (Math.pow(env.night, 1.6) * (1 - cloud * 0.85)).toFixed(2));
      setS(arc, 'opacity', (0.25 + 0.75 * env.dayK).toFixed(2));
      this.$('.clouds').style.opacity = (0.25 + cloud * 0.75).toFixed(2);
      var sub = this.$('.sub');
      if (sub) setT(sub, now2(env));
    }

    _updateScene(env) {
      var sc = this._sc, S = this._hass.states, rs = this._rs;
      if (!sc) return;
      var pal = env.pal, night = env.night;
      sc.base.forEach(function (b) { setA(b, 'fill', css(b.classList.contains('top') ? pal.base : pal.baseSide)); });
      // sun wash: light slides across the house from east (left) to west (right)
      var vb = sc.vb, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2, L = Math.hypot(vb.w, vb.h) / 2;
      var dx = -2 * Math.sin(env.az * Math.PI / 180), dy = -Math.cos(env.az * Math.PI / 180), dl = Math.hypot(dx, dy) || 1;
      dx /= dl; dy /= dl;
      var g = sc.washGrad;
      if (g) {
        setA(g, 'x1', (cx + dx * L).toFixed(1)); setA(g, 'y1', (cy + dy * L).toFixed(1));
        setA(g, 'x2', (cx - dx * L).toFixed(1)); setA(g, 'y2', (cy - dy * L).toFixed(1));
        var strength = (0.42 * env.dayK * smooth(env.elev, 0, 22)).toFixed(3);
        var st = g.querySelectorAll('stop');
        setA(st[0], 'stop-opacity', strength); setA(st[0], 'stop-color', css(env.sunCol));
        setA(st[1], 'stop-color', css(env.sunCol));
      }
      var vis = 0.4 + 0.6 * night;
      sc.rooms.forEach(function (R) {
        var r = R.room, s = rs[r.id]; if (!s) return;
        var I = s.glow.i, tint = s.glow.rgb;
        setA(R.floor, 'fill', css(mixA(pal.floor, tint, I * 0.42 * vis)));
        var wN = css(mixA(pal.wallN, tint, I * 0.3 * vis)), wW = css(mixA(pal.wallW, tint, I * 0.3 * vis));
        setA(R.wN, 'fill', wN); setA(R.wW, 'fill', wW);
        R.caps.forEach(function (c) { setA(c, 'fill', css(pal.cap)); });
        R.lows.forEach(function (c) { setA(c, 'fill', css(mixA(pal.low, tint, I * 0.2 * vis))); });
        var win = mixA(hex('#bfe2ff'), hex('#0e1838'), night);
        win = mixA(win, [255, 205, 130], I * 0.55 * (0.3 + 0.7 * night));
        R.wins.forEach(function (w) { setA(w, 'fill', css(win, 0.92)); });
        setC(R.pres, 'on', s.pres.on);
        var lab = s.t != null ? fmt(s.t, 1) + (s.tu || '°') : '';
        if (s.hu != null) lab += (lab ? ' · ' : '') + Math.round(s.hu) + '%';
        setT(R.tmp, lab);
      });
      sc.devs.forEach(function (d) {
        var st = S[d.id], on = st && isOn(d.kind, st), na = !st || st.state === 'unavailable';
        setC(d.el, 'on', on); setC(d.el, 'na', na);
        if (!st) return;
        var col = accentFor(d.kind, st);
        setS(d.el, '--c', css(col));
        if (d.glow) {
          var b = d.kind === 'light' ? lightBri(st) : 1;
          if (on) {
            var rad = d.kind === 'tv' ? 2.3 : 1.15 + 1.0 * b;
            setA(d.glow, 'rx', (rad * 1.414 * TW).toFixed(1)); setA(d.glow, 'ry', (rad * 1.414 * TH).toFixed(1));
            var o = ((0.45 + 0.55 * night) * (d.kind === 'tv' ? 0.95 : (0.45 + 0.55 * b))).toFixed(2);
            setS(d.glow, 'opacity', o);
            var c = d.kind === 'tv' ? [110, 170, 255] : col;
            for (var i = 0; i < d.stops.length; i++) setA(d.stops[i], 'stop-color', css(c));
          } else setS(d.glow, 'opacity', '0');
        }
      });
    }

    _updateAvatars(S) {
      var sc = this._sc, rs = this._rs, self = this;
      var map = {}, used = {};
      var rooms = this._model.rooms;
      var present = rooms.filter(function (r) { return rs[r.id] && rs[r.id].pres.on; })
        .sort(function (a, b) { return rs[b.id].pres.t - rs[a.id].pres.t; });
      var home = this._persons.filter(function (p) { return S[p.entity] && S[p.entity].state === 'home'; });
      // explicit: a sensor that reports the room/area a person is in (Bermuda, ESPresense, ...)
      this._persons.forEach(function (p) {
        if (!p.area_sensor || !S[p.area_sensor]) return;
        var v = S[p.area_sensor].state, nv = normName(v);
        if (!v || v === 'unknown' || v === 'unavailable' || v === 'not_home') return;
        var rm = rooms.filter(function (r) { return r.id === v || r.area === v || normName(r.name) === nv; })[0];
        if (rm) { map[p.entity] = rm.id; used[rm.id] = 1; }
      });
      var free = present.filter(function (r) { return !used[r.id]; });
      var undecided = home.filter(function (p) { return !map[p.entity] && !p.area_sensor; });
      if (undecided.length === 1 && free.length >= 1) { map[undecided[0].entity] = free[0].id; used[free[0].id] = 1; }
      var generic = present.filter(function (r) { return !used[r.id]; });
      this._active = map;

      var perRoom = {};
      var place = function (key, roomId) {
        var A = sc && sc.avs[key]; if (!A) return;
        var R = null;
        for (var i = 0; i < sc.rooms.length; i++) if (sc.rooms[i].room.id === roomId) { R = sc.rooms[i]; break; }
        if (!R) { setC(A.el, 'on', false); setC(A.el, 'detected', false); A.placed = false; return; }
        var n = perRoom[roomId] = (perRoom[roomId] || 0) + 1;
        var r = R.room, off = (n - 1) * 0.9;
        var p = iso(r.x + r.w * 0.5 + off - 0.3, r.y + r.h * 0.52 + off * 0.3, 0);
        var tf = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)';
        if (!A.placed) { A.el.style.transition = 'none'; A.el.style.transform = tf; void A.el.getBoundingClientRect(); A.el.style.transition = ''; A.placed = true; }
        else if (A.el.style.transform !== tf) A.el.style.transform = tf;
        setC(A.el, 'on', true); setC(A.el, 'detected', true);
      };
      var seen = {};
      Object.keys(map).forEach(function (k) { place(k, map[k]); seen[k] = 1; });
      var gi = 0;
      generic.forEach(function (r) { if (gi < 6) { var k = 'generic-' + gi++; place(k, r.id); seen[k] = 1; } });
      if (sc) Object.keys(sc.avs).forEach(function (k) {
        if (seen[k]) return;
        var A = sc.avs[k]; setC(A.el, 'on', false); setC(A.el, 'detected', false); A.placed = false;
      });
    }

    _updateHeader(S) {
      var self = this;
      this._persons.forEach(function (p, i) {
        var el = self.$('.pp[data-p="' + i + '"]'); if (!el) return;
        var st = S[p.entity];
        setC(el, 'home', st && st.state === 'home');
        setC(el, 'active', !!(self._active && self._active[p.entity]));
      });
    }

    _updateGlance(S) {
      var self = this, rs = this._rs, rooms = this._model.rooms, cfg = this._config;
      var lights = 0, tvs = 0, open = 0, temps = [], alarms = 0;
      rooms.forEach(function (r) {
        var s = rs[r.id]; if (!s) return;
        lights += s.glow.lights; tvs += s.glow.tvs; open += s.open; alarms += s.alarm;
        if (s.t != null) temps.push(s.t);
      });
      var homeN = this._persons.filter(function (p) { return S[p.entity] && S[p.entity].state === 'home'; }).length;
      var chips = [];
      if (this._persons.length) chips.push({ e: '👥', v: homeN + '/' + this._persons.length, l: 'Home', act: 'more', id: null });
      chips.push({ e: '💡', v: lights, l: lights === 1 ? 'Light on' : 'Lights on' });
      chips.push({ e: '📺', v: tvs, l: tvs === 1 ? 'TV on' : 'TVs on' });
      if (this._sec.length) chips.push({ e: open || alarms ? '🚪' : '🔐', v: alarms ? alarms + ' alert' : open, l: alarms ? 'Check now' : 'Open', tab: 'security', live: alarms > 0 });
      if (temps.length) chips.push({ e: '🌡️', v: fmt(temps.reduce(function (a, b) { return a + b; }, 0) / temps.length, 1) + '°', l: 'Average', tab: 'climate' });
      if (this._en && this._en.src && this._tabOn('energy')) {
        var pn = powerNow(this._en.src, S);
        if (pn.home != null) chips.push({ e: '⚡', v: fmtPower(pn.home), l: 'Home now', tab: 'energy' });
        var gt = this._gasToday();
        if (gt && gt.v != null) chips.push({ e: '🔥', v: fmt(gt.v, 2) + ' ' + gt.unit, l: 'Gas today', tab: 'energy' });
      }
      (cfg.modes || []).forEach(function (m) {
        var id = typeof m === 'string' ? m : m.entity, s = S[id]; if (!s) return;
        var nm = (typeof m === 'object' && m.name) || (s.attributes && s.attributes.friendly_name) || id;
        var ic = (typeof m === 'object' && m.icon) || '✨';
        chips.push({ e: ic, v: nm, l: ['scene', 'script', 'button'].indexOf(domainOf(id)) >= 0 ? 'Run' : (s.state === 'on' ? 'On' : 'Off'), mode: id, on: s.state === 'on' });
      });
      var sig = JSON.stringify(chips);
      if (sig === this._glanceSig) return;
      this._glanceSig = sig;
      this.$('.glance').innerHTML = chips.map(function (c) {
        var att = c.mode ? ' data-act="toggle" data-id="' + esc(c.mode) + '"' : (c.tab ? ' data-act="tab" data-v="' + c.tab + '"' : '');
        return '<button class="chip' + (c.live ? ' live' : '') + (c.mode ? ' mode' + (c.on ? ' on' : '') : '') + '"' + att + '><span class="e">' + c.e + '</span><span><b>' + esc(c.v) + '</b>' + esc(c.l) + '</span></button>';
      }).join('');
    }

    _tabOn(t) { return this._config.tabs.indexOf(t) >= 0; }

    _updateFloors() {
      var self = this, rs = this._rs;
      this.shadowRoot.querySelectorAll('.fb').forEach(function (b) {
        var fid = b.getAttribute('data-v');
        setC(b, 'on', fid === self._floor);
        var f = self._model.floors.filter(function (x) { return x.id === fid; })[0];
        var dot = b.querySelector('u');
        if (f && dot) dot.style.display = (fid !== self._floor && f.rooms.some(function (r) { return rs[r.id] && rs[r.id].pres.on; })) ? '' : 'none';
      });
    }

    /* -------------------------------------------------------------- actions */
    _act(el) {
      var act = el.getAttribute('data-act'), id = el.getAttribute('data-id'), v = el.getAttribute('data-v');
      var H = this._hass, st = id && H.states[id];
      switch (act) {
        case 'tab': this._setTab(v); break;
        case 'floor': this._floor = v; this._buildFloors(); this._buildScene(); this._update(); break;
        case 'toggle': this._toggle(id); break;
        case 'more': if (id) this._more(id); break;
        case 'close': this._closeSheet(); break;
        case 'cover': H.callService('cover', v + '_cover', { entity_id: id }); break;
        case 'media': H.callService('media_player', v, { entity_id: id }); break;
        case 'vac': H.callService('vacuum', v, { entity_id: id }); break;
        case 'temp': {
          if (!st) break;
          var a = st.attributes || {}, cur = num(a.temperature); if (cur == null) break;
          var step = num(a.target_temp_step) || ((H.config && H.config.unit_system && H.config.unit_system.temperature === '°F') ? 1 : 0.5);
          var nv = +(cur + (+v) * step).toFixed(1);
          H.callService('climate', 'set_temperature', { entity_id: id, temperature: nv });
          break;
        }
      }
    }

    _toggle(id) {
      var H = this._hass, st = H.states[id]; if (!st) return;
      var dom = domainOf(id), name = (st.attributes && st.attributes.friendly_name) || id;
      var call = function (d, s) { H.callService(d, s, { entity_id: id }); };
      if (dom === 'lock') {
        if (st.state === 'locked') { if (!window.confirm('Unlock ' + name + '?')) return; call('lock', 'unlock'); } else call('lock', 'lock');
      } else if (dom === 'cover') call('cover', 'toggle');
      else if (dom === 'media_player') call('media_player', 'toggle');
      else if (dom === 'climate') call('climate', st.state === 'off' ? 'turn_on' : 'turn_off');
      else if (dom === 'vacuum') call('vacuum', st.state === 'cleaning' ? 'return_to_base' : 'start');
      else if (dom === 'scene' || dom === 'script') call(dom, 'turn_on');
      else if (dom === 'button') call('button', 'press');
      else call('homeassistant', 'toggle');
    }

    _more(id) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: id } }));
    }

    /* ---------------------------------------------------------------- sheet */
    _openSheet(roomId) {
      this._sheet = roomId; this._renderSheet();
      this.$('.sheet').classList.add('on'); this.$('.scrim').classList.add('on');
    }
    _closeSheet() {
      this._sheet = null; this._busy = false;
      this.$('.sheet').classList.remove('on'); this.$('.scrim').classList.remove('on');
    }

    _stateText(d, st) {
      var a = st.attributes || {}, s = st.state;
      if (s === 'unavailable') return 'Unavailable';
      switch (d.kind) {
        case 'light': return s === 'on' ? 'On · ' + Math.round(lightBri(st) * 100) + '%' : 'Off';
        case 'tv': case 'speaker':
          if (s === 'playing' || s === 'paused') return (s === 'playing' ? 'Playing' : 'Paused') + (a.media_title ? ' · ' + a.media_title : (a.app_name ? ' · ' + a.app_name : ''));
          return s === 'off' || s === 'standby' ? 'Off' : (s.charAt(0).toUpperCase() + s.slice(1));
        case 'climate': {
          var u = (this._hass.config && this._hass.config.unit_system && this._hass.config.unit_system.temperature) || '°C';
          return (a.hvac_action ? a.hvac_action + ' · ' : '') + (a.current_temperature != null ? fmt(+a.current_temperature, 1) + u : '') + (a.temperature != null ? ' → ' + fmt(+a.temperature, 1) + u : '') || s;
        }
        case 'cover': return s.charAt(0).toUpperCase() + s.slice(1) + (a.current_position != null ? ' · ' + a.current_position + '%' : '');
        default: return s.charAt(0).toUpperCase() + s.slice(1);
      }
    }

    _renderSheet() {
      var S = this._hass.states, r = this._model.rooms.filter(function (x) { return x.id === this._sheet; }, this)[0];
      if (!r) { this._closeSheet(); return; }
      var rs = this._rs[r.id] || {}, self = this;
      var h = '<div class="grab"></div><div class="sh-h"><h2>' + esc(r.name) + '</h2>';
      if (rs.t != null) h += '<span class="mut">' + fmt(rs.t, 1) + (rs.tu || '°') + (rs.hu != null ? ' · ' + Math.round(rs.hu) + '%' : '') + '</span>';
      h += '<button class="x" data-act="close">✕</button></div>';
      var sens = '';
      if (rs.pres && rs.pres.on) sens += '<span class="hot">🧍 Someone is here</span>';
      r.openings.forEach(function (id) { var s = S[id]; if (s) sens += '<span class="' + (s.state === 'on' ? 'bad' : '') + '">' + (s.state === 'on' ? '🚪 ' : '✓ ') + esc((s.attributes.friendly_name || id)) + '</span>'; });
      r.alarms.forEach(function (id) { var s = S[id]; if (s && s.state === 'on') sens += '<span class="bad">⚠️ ' + esc(s.attributes.friendly_name || id) + '</span>'; });
      if (sens) h += '<div class="sens">' + sens + '</div>';
      var groups = [['light', 'Lights'], ['tv', 'TV'], ['speaker', 'Speakers'], ['climate', 'Climate'], ['fan', 'Fans'], ['switch', 'Switches'], ['cover', 'Blinds & covers'], ['vacuum', 'Vacuum'], ['lock', 'Locks']];
      groups.forEach(function (g) {
        var list = r.devs.filter(function (d) { return d.kind === g[0]; });
        if (!list.length) return;
        h += '<div class="sh-sec">' + g[1] + '</div>';
        list.forEach(function (d) {
          var st = S[d.id]; if (!st) return;
          var on = isOn(d.kind, st), col = css(accentFor(d.kind, st)), a = st.attributes || {};
          h += '<div class="dr' + (on ? ' on' : '') + '" style="--ac:' + col + '"><button class="ic" data-act="toggle" data-id="' + esc(d.id) + '">' + ICON[d.kind] + '</button>' +
            '<div class="nm"><b>' + esc(d.name) + '</b><span>' + esc(self._stateText(d, st)) + '</span></div><div class="ctl">';
          if (d.kind === 'cover') h += '<button class="sq" data-act="cover" data-v="open" data-id="' + esc(d.id) + '">▲</button><button class="sq" data-act="cover" data-v="stop" data-id="' + esc(d.id) + '">■</button><button class="sq" data-act="cover" data-v="close" data-id="' + esc(d.id) + '">▼</button>';
          else if (d.kind === 'tv' || d.kind === 'speaker') h += '<button class="sq" data-act="media" data-v="media_previous_track" data-id="' + esc(d.id) + '">⏮</button><button class="sq" data-act="media" data-v="media_play_pause" data-id="' + esc(d.id) + '">⏯</button><button class="sq" data-act="media" data-v="media_next_track" data-id="' + esc(d.id) + '">⏭</button>';
          else if (d.kind === 'climate' && a.temperature != null) h += '<div class="stepper"><button data-act="temp" data-v="-1" data-id="' + esc(d.id) + '">−</button><button data-act="temp" data-v="1" data-id="' + esc(d.id) + '">+</button></div>';
          else if (d.kind === 'vacuum') h += '<button class="sq" data-act="vac" data-v="start" data-id="' + esc(d.id) + '">▶</button><button class="sq" data-act="vac" data-v="return_to_base" data-id="' + esc(d.id) + '">⌂</button>';
          h += '</div><button class="info" data-act="more" data-id="' + esc(d.id) + '">i</button>';
          var modes = a.supported_color_modes || [];
          if (d.kind === 'light' && modes.length && !(modes.length === 1 && modes[0] === 'onoff')) {
            h += '<input class="sl" type="range" min="1" max="100" value="' + Math.round(lightBri(st) * 100) + '" data-bri="' + esc(d.id) + '"' + (on ? '' : ' disabled') + '>';
          }
          h += '</div>';
        });
      });
      if (!r.devs.length) h += '<p class="mut">No controllable devices are assigned to this area yet.</p>';
      var sh = this.$('.sheet');
      var keep = sh.scrollTop;
      sh.innerHTML = h; sh.scrollTop = keep;
    }

    /* -------------------------------------------------------------- climate */
    _renderClimate(S) {
      var rs = this._rs, rooms = this._model.rooms, hass = this._hass;
      var unit = (hass.config && hass.config.unit_system && hass.config.unit_system.temperature) || '°C';
      var tcol = function (t) {
        var c = unit === '°F' ? (t - 32) / 1.8 : t;
        var k = clamp((c - 16) / 12, 0, 1);
        return css(mixA([90, 160, 255], [255, 140, 70], k));
      };
      var h = '<div class="grid">';
      var any = false;
      rooms.forEach(function (r) {
        var s = rs[r.id]; if (!s || (s.t == null && s.hu == null)) return;
        any = true;
        h += '<div class="rc" data-id="' + esc(r.temp || '') + '" style="--tc:' + (s.t != null ? tcol(s.t) : '#888') + '"><small>' + esc(r.name) + '</small><b>' + (s.t != null ? fmt(s.t, 1) + '<em style="margin:0">' + esc(s.tu || unit) + '</em>' : '–') + '</b>' +
          (s.hu != null ? '<em>💧 ' + Math.round(s.hu) + '%</em>' : '') + '</div>';
      });
      h += '</div>';
      if (!any) h = '<div class="glasscard"><h3>Rooms</h3><div class="mut">No temperature sensors found in your areas. Give a temperature sensor an area and it shows up here.</div></div>';
      if (this._thermo.length) {
        h += '<div class="grid">';
        this._thermo.forEach(function (id) {
          var st = S[id]; if (!st) return;
          var a = st.attributes || {}, act = a.hvac_action || st.state;
          h += '<div class="rc" data-id="' + esc(id) + '" style="--tc:' + (a.hvac_action === 'heating' ? '#ff8c46' : a.hvac_action === 'cooling' ? '#5aa0ff' : '#888') + '"><small>' + esc(a.friendly_name || id) + '</small>' +
            '<b>' + (a.current_temperature != null ? fmt(+a.current_temperature, 1) : '–') + '<em style="margin:0">' + unit + '</em></b><em>' + esc(String(act)) + (a.temperature != null ? ' → ' + fmt(+a.temperature, 1) : '') + '</em>' +
            (a.temperature != null ? '<div class="stepper"><button data-act="temp" data-v="-1" data-id="' + esc(id) + '">−</button><button data-act="temp" data-v="1" data-id="' + esc(id) + '">+</button><button class="sq" data-act="toggle" data-id="' + esc(id) + '">⏻</button></div>' : '') + '</div>';
        });
        h += '</div>';
      }
      var sig = h; if (sig === this._climSig) return; this._climSig = sig;
      this.$('.page.climate .panel').innerHTML = h;
    }

    /* ------------------------------------------------------------- security */
    _renderSecurity(S) {
      var rows = [], emoji = { door: '🚪', window: '🪟', garage_door: '🏠', opening: '🚪', smoke: '🔥', gas: '☁️', carbon_monoxide: '☁️', moisture: '💧', safety: '⚠️' };
      this._sec.forEach(function (id) {
        var s = S[id]; if (!s) return;
        var dom = domainOf(id), a = s.attributes || {}, dc = a.device_class, name = a.friendly_name || id, bad = false, txt = s.state, e = '🔒';
        if (dom === 'alarm_control_panel') { e = '🚨'; bad = s.state === 'triggered'; txt = s.state.replace(/_/g, ' '); }
        else if (dom === 'lock') { e = s.state === 'locked' ? '🔒' : '🔓'; bad = s.state !== 'locked'; txt = s.state; }
        else { e = emoji[dc] || '🚪'; bad = s.state === 'on'; txt = (['smoke', 'gas', 'carbon_monoxide', 'moisture', 'safety'].indexOf(dc) >= 0) ? (bad ? 'ALERT' : 'clear') : (bad ? 'open' : 'closed'); }
        rows.push({ id: id, e: e, name: name, txt: txt, bad: bad, dom: dom });
      });
      rows.sort(function (a, b) { return (b.bad - a.bad) || a.name.localeCompare(b.name); });
      var h = '<div class="glasscard"><h3>Doors, windows & locks<small>' + rows.filter(function (r) { return r.bad; }).length + ' need attention</small></h3>';
      if (!rows.length) h += '<div class="mut">No door, window, lock or alarm entities found.</div>';
      rows.forEach(function (r) {
        h += '<div class="item' + (r.bad ? ' bad' : '') + '" data-id="' + esc(r.id) + '"' + (r.dom === 'lock' ? ' data-act="toggle"' : ' data-act="more"') + '><span class="e">' + r.e + '</span>' + esc(r.name) + '<span class="s">' + esc(r.txt) + '</span></div>';
      });
      h += '</div>';
      if (h === this._secSig) return; this._secSig = h;
      this.$('.page.security .panel').innerHTML = h;
    }

    /* --------------------------------------------------------------- energy */
    _loadEnergy(force) {
      var self = this, hass = this._hass;
      if (!hass || this._enLoading) return;
      if (!force && this._en && Date.now() - this._en.at < 120000) return;
      this._enLoading = true;
      var pr = hass.callWS({ type: 'energy/get_prefs' }).then(function (p) { return { p: p }; }, function (e) { return { p: null, e: e }; });
      pr.then(function (r) {
        var src = parseEnergy(r.p, self._config.energy, hass.states);
        return fetchStats(hass, src).then(function (stats) {
          self._en = { at: Date.now(), src: src, stats: stats, prefErr: r.e ? String(r.e.message || r.e.code || r.e) : null };
        });
      }).catch(function (e) {
        console.warn('[sweet-floor-card] energy load failed', e);
        self._en = { at: Date.now(), src: parseEnergy(null, self._config.energy, hass.states), stats: null, prefErr: String((e && e.message) || e) };
      }).then(function () {
        self._enLoading = false;
        if (self._built) { self._collectRelevant(); self._energyBuilt = false; self._glanceSig = null; self._update(); }
      });
    }

    _gasToday() {
      var en = this._en; if (!en) return null;
      var ids = en.src.gas.energy; if (!ids.length) return null;
      var S = this._hass.states, stats = en.stats, unit = unitOf(stats, S, ids[0]) || 'm³';
      var hours = stats && stats.ok ? sumHours(stats, S, ids, false) : null;
      var v = null, est = false;
      if (hours) {
        v = hours.reduce(function (a, b) { return a + b; }, 0);
      } else {
        v = baselineToday(S, ids, false, stats);
        est = true;
      }
      if (v == null || v === 0) {
        var s0 = S[ids[0]];
        if (s0 && /today|daily|day/i.test(ids[0])) {
          var direct = num(s0.state);
          if (direct != null && direct > 0) { v = direct; est = false; }
        }
      }
      var curH = new Date().getHours();
      return {
        v: v, unit: unit, hours: hours, est: est,
        thisHour: hours ? hours[curH] : null,
        lastHour: hours ? hours[(curH + 23) % 24] : null
      };
    }

    _renderEnergyLive() {
      var en = this._en, S = this._hass.states;
      var page = this.$('.page.energy .panel');
      if (!en) { if (!page.firstChild) page.innerHTML = '<div class="glasscard"><div class="mut">Loading energy data…</div></div>'; return; }
      if (!this._energyBuilt) { this._buildEnergy(page); this._energyBuilt = true; }
      var src = en.src, pn = powerNow(src, S), gas = this._gasToday();
      var thr = 8;
      var set = function (sel, txt) { setT(page.querySelector(sel), txt); };
      var node = function (n, on) { var el = page.querySelector('.node.' + n); setC(el, 'act', on); };
      var flow = function (id, on, rev, w) {
        var el = page.querySelector('#' + id); if (!el) return;
        setC(el, 'on', on); setC(el, 'rev', rev);
        if (on) el.style.animationDuration = clamp(3.6 - Math.log10(Math.abs(w || 100) + 10) * 0.8, 0.6, 3.2).toFixed(2) + 's';
      };
      set('.node.solar .nv', pn.solar == null ? '–' : fmtPower(pn.solar));
      set('.node.grid .nv', pn.grid == null ? '–' : fmtPower(pn.grid));
      set('.node.grid .nl', pn.grid == null ? 'Grid' : (pn.grid < -thr ? 'Exporting' : 'Grid'));
      set('.node.home .nv', pn.home == null ? '–' : fmtPower(pn.home));
      set('.node.battery .nv', pn.battery == null ? '–' : fmtPower(pn.battery));
      set('.node.battery .nl', pn.battery == null ? 'Battery' : (pn.battery < -thr ? 'Charging' : (pn.battery > thr ? 'Discharging' : 'Battery')));
      set('.node.gas .nv', gas && gas.v != null ? fmt(gas.v, 2) + ' ' + gas.unit : '–');
      set('.node.gas .nl', gas && gas.thisHour != null ? 'This hour ' + fmt(gas.thisHour, 3) : 'Gas today');
      node('solar', pn.solar != null && pn.solar > thr); node('grid', pn.grid != null && Math.abs(pn.grid) > thr);
      node('battery', pn.battery != null && Math.abs(pn.battery) > thr);
      var gasActive = !!(gas && (gas.thisHour > 0 || (gas.v != null && gas.v > 0)));
      node('home', pn.home != null && pn.home > thr); node('gas', gasActive);
      flow('f-solar', pn.solar != null && pn.solar > thr, false, pn.solar);
      flow('f-grid', pn.grid != null && Math.abs(pn.grid) > thr, pn.grid != null && pn.grid < 0, pn.grid);
      flow('f-batt', pn.battery != null && Math.abs(pn.battery) > thr, pn.battery != null && pn.battery < 0, pn.battery);
      flow('f-gas', gasActive, false, 400);
      var vis = function (sel, on) { var el = page.querySelector(sel); if (el) el.style.display = on ? '' : 'none'; };
      vis('.node.solar', src.solar.power.length > 0 || src.solar.energy.length > 0); vis('.pf-solar', src.solar.power.length > 0 || src.solar.energy.length > 0);
      vis('.node.battery', src.battery.power.length > 0 || src.battery.from.length > 0); vis('.pf-batt', src.battery.power.length > 0 || src.battery.from.length > 0);
      vis('.node.gas', src.gas.energy.length > 0); vis('.pf-gas', src.gas.energy.length > 0);
    }

    _buildEnergy(page) {
      var en = this._en, src = en.src, S = this._hass.states, stats = en.stats, self = this;
      var kwh = function (ids) {
        if (!ids.length) return null;
        if (stats && stats.ok) { var hrs = sumHours(stats, S, ids, true); if (hrs) return { v: hrs.reduce(function (a, b) { return a + b; }, 0), est: false }; }
        var b = baselineToday(S, ids, true, stats); return b == null ? null : { v: b, est: true };
      };
      var imp = kwh(src.grid.from), exp = kwh(src.grid.to), sol = kwh(src.solar.energy);
      var bIn = kwh(src.battery.to), bOut = kwh(src.battery.from);
      var gas = this._gasToday();
      var tiles = [];
      var T = function (l, v, sub) { tiles.push('<div class="tile"><small>' + l + '</small><b>' + v + '</b><em>' + (sub || '') + '</em></div>'); };
      if (imp) T('Imported today', fmt(imp.v, 2) + ' kWh', imp.est ? 'since card loaded' : 'from the grid');
      if (exp) T('Exported today', fmt(exp.v, 2) + ' kWh', exp.est ? 'since card loaded' : 'to the grid');
      if (sol) T('Solar today', fmt(sol.v, 2) + ' kWh', sol.est ? 'since card loaded' : 'produced');
      if (imp && !imp.est) {
        var used = imp.v + (sol ? sol.v : 0) + (bOut ? bOut.v : 0) - (exp ? exp.v : 0) - (bIn ? bIn.v : 0);
        T('Home used today', fmt(Math.max(0, used), 2) + ' kWh', 'import + solar − export');
      }
      if (gas && gas.v != null) {
        T('Gas today', fmt(gas.v, 2) + ' ' + gas.unit, gas.est ? 'since card loaded' : 'since midnight');
        if (gas.thisHour != null) T('Gas this hour', fmt(gas.thisHour, 3) + ' ' + gas.unit, 'last hour ' + fmt(gas.lastHour, 3));
      }

      var h = '';
      h += '<div class="glasscard"><h3>Live flow<small class="mut">updates as sensors change</small></h3>' +
        '<svg class="flow" viewBox="0 0 640 330" xmlns="http://www.w3.org/2000/svg">' +
        '<path class="fl pf-solar" d="M150 92 C 230 110, 250 150, 282 164"/><path class="fa" id="f-solar" stroke="#ffc83d" d="M150 92 C 230 110, 250 150, 282 164"/>' +
        '<path class="fl" d="M490 92 C 410 110, 390 150, 358 164"/><path class="fa" id="f-grid" stroke="#5aa9ff" d="M490 92 C 410 110, 390 150, 358 164"/>' +
        '<path class="fl pf-batt" d="M150 258 C 230 240, 250 200, 282 188"/><path class="fa" id="f-batt" stroke="#5be3a8" d="M150 258 C 230 240, 250 200, 282 188"/>' +
        '<path class="fl pf-gas" d="M490 258 C 410 240, 390 200, 358 188"/><path class="fa" id="f-gas" stroke="#ff7a45" d="M490 258 C 410 240, 390 200, 358 188"/>' +
        this._node('solar', 110, 70, '☀️', 'Solar', '#ffc83d') + this._node('grid', 530, 70, '🗼', 'Grid', '#5aa9ff') +
        this._node('home', 320, 176, '🏠', 'Home', '#ffffff', 48) + this._node('battery', 110, 280, '🔋', 'Battery', '#5be3a8') + this._node('gas', 530, 280, '🔥', 'Gas today', '#ff7a45') +
        '</svg></div>';
      if (tiles.length) h += '<div class="tiles">' + tiles.join('') + '</div>';

      // charts
      var charts = '';
      var elHours = stats && stats.ok ? sumHours(stats, S, src.grid.from, true) : null;
      var solHours = stats && stats.ok ? sumHours(stats, S, src.solar.energy, true) : null;
      if (elHours || solHours) charts += '<div class="glasscard"><h3>Electricity today<small>kWh per hour</small></h3>' + this._bars(elHours, '#5aa9ff', 'h', solHours, '#ffc83d') +
        '<div class="mut">' + (elHours ? '<span style="color:#5aa9ff">■</span> imported ' : '') + (solHours ? '<span style="color:#ffc83d">■</span> solar' : '') + '</div></div>';
      var gasHours = gas && gas.hours;
      if (gasHours) charts += '<div class="glasscard"><h3>Gas today<small>' + esc(gas.unit) + ' per hour</small></h3>' + this._bars(gasHours, '#ff7a45', 'h') + '</div>';
      var eDays = stats && stats.ok ? sumDays(stats, S, src.grid.from, true) : null;
      var gDays = src.gas.energy.length && stats && stats.ok ? sumDays(stats, S, src.gas.energy, false) : null;
      if (eDays) charts += '<div class="glasscard"><h3>Electricity, last 7 days<small>kWh imported</small></h3>' + this._bars(eDays, '#5aa9ff', 'd') + '</div>';
      if (gDays) charts += '<div class="glasscard"><h3>Gas, last 7 days<small>' + esc(gas ? gas.unit : '') + '</small></h3>' + this._bars(gDays, '#ff7a45', 'd') + '</div>';
      if (charts) h += '<div class="row2">' + charts + '</div>';

      // top devices
      if (stats && stats.ok && src.devices.length) {
        var tops = src.devices.map(function (d) {
          var hrs = sumHours(stats, S, [d.stat], true);
          var s = S[d.stat];
          return { name: d.name || (s && s.attributes.friendly_name) || d.stat, v: hrs ? hrs.reduce(function (a, b) { return a + b; }, 0) : 0 };
        }).filter(function (d) { return d.v > 0; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 6);
        if (tops.length) {
          var mx = tops[0].v;
          h += '<div class="glasscard toplist"><h3>Top devices today<small>kWh</small></h3>' + tops.map(function (d) {
            return '<div class="tl"><span>' + esc(d.name) + '</span><span>' + fmt(d.v, 2) + '</span><div><i style="width:' + (d.v / mx * 100).toFixed(0) + '%"></i></div></div>';
          }).join('') + '</div>';
        }
      }

      // diagnostics
      var have = src.grid.power.length + src.solar.power.length + (src.home ? 1 : 0) + src.gas.energy.length + src.grid.from.length;
      var notes = [];
      if (!have) notes.push('No energy sources found. Add them in <code>Settings → Dashboards → Energy</code>, or set <code>energy:</code> in this card (see README).');
      if (src.auto.length) notes.push('Auto-detected: ' + src.auto.map(function (x) { return '<code>' + esc(x) + '</code>'; }).join(', ') + '. Set <code>energy:</code> in the card to pin them.');
      if (!src.fromPrefs && have) notes.push('Energy dashboard preferences could not be read, so sensors were auto-detected.');
      if (stats && !stats.ok && src.gas.energy.length + src.grid.from.length) notes.push('Long-term statistics are unavailable' + (stats.err ? ' (' + esc(stats.err) + ')' : '') + '. Daily totals count from when this card first loaded today.');
      if (!src.grid.power.length && !src.home && !src.solar.power.length) notes.push('No live power sensor (W/kW) was found, so the flow lines stay idle. Daily totals still work.');
      if (notes.length) h += '<div class="glasscard"><h3>Setup notes</h3><div class="mut">' + notes.join('<br>') + '</div></div>';
      page.innerHTML = h;
    }

    _node(cls, x, y, emo, label, color, r) {
      r = r || 38;
      return '<g class="node ' + cls + '" style="--nc:' + color + '"><circle class="ring" cx="' + x + '" cy="' + y + '" r="' + r + '"/>' +
        '<text x="' + x + '" y="' + (y + 9) + '" text-anchor="middle" font-size="' + (r > 40 ? 32 : 28) + '">' + emo + '</text>' +
        '<text class="nl" x="' + x + '" y="' + (y - r - 24) + '" text-anchor="middle">' + label + '</text>' +
        '<text class="nv" x="' + x + '" y="' + (y - r - 8) + '" text-anchor="middle">–</text></g>';
    }

    _bars(a, color, mode, b, color2) {
      var items = [];
      if (mode === 'h') {
        for (var i = 0; i < 24; i++) items.push({ l: (i % 6 === 0 ? String(i).padStart(2, '0') : ''), t: String(i).padStart(2, '0') + ':00', v: a ? a[i] : 0, v2: b ? b[i] : 0 });
      } else a.forEach(function (d) { items.push({ l: d.label, t: d.label, v: d.v, v2: 0 }); });
      var mx = 0; items.forEach(function (it) { mx = Math.max(mx, it.v, it.v2 || 0); });
      mx = mx || 1;
      return '<div class="bars pad" style="--c:' + color + '">' + items.map(function (it) {
        var s = '<div class="b" title="' + esc(it.t) + ': ' + fmt(it.v, 2) + (b ? ' / ' + fmt(it.v2, 2) : '') + '">';
        s += '<i style="height:' + (it.v / mx * 100).toFixed(1) + '%"></i>';
        if (b) s += '<i style="height:' + (it.v2 / mx * 100).toFixed(1) + '%;--c:' + color2 + '"></i>';
        return s + '<em>' + esc(it.l) + '</em></div>';
      }).join('') + '</div>';
    }
  }

  function now2(env) {
    var hh = Math.floor(env.hour), mm = Math.floor((env.hour - hh) * 60);
    var t = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    var phase = env.elev > 8 ? 'Daytime' : env.elev > -4 ? (env.hour < 12 ? 'Sunrise' : 'Sunset') : 'Night';
    return t + ' · ' + phase;
  }

  var ALIASES = ['sweet-floor-card', 'ha-sweet-home', 'sweet-home-card', 'sweet-floor', 'next-floor-card'];
  ALIASES.forEach(function (tag) {
    if (!window.customElements.get(tag)) {
      window.customElements.define(tag, SweetFloorCard);
    }
  });

  window.customCards = window.customCards || [];
  if (!window.customCards.some(function (c) { return c.type === 'sweet-floor-card'; })) {
    window.customCards.push({
      type: 'sweet-floor-card',
      name: 'Sweet Floor Card',
      preview: true,
      description: 'Dollhouse floor plan with day/night sky, moving sun, lit rooms, live presence and Energy + Gas.'
    });
    window.customCards.push({
      type: 'ha-sweet-home',
      name: 'Sweet Home (Sweet Floor)',
      preview: true,
      description: 'Dollhouse floor plan with day/night sky, moving sun, lit rooms, live presence and Energy + Gas.'
    });
  }
  console.info('%c SWEET-FLOOR-CARD %c v' + VERSION + ' ', 'background:#27364f;color:#fff;border-radius:3px 0 0 3px;padding:2px 4px', 'background:#ffc566;color:#222;border-radius:0 3px 3px 0;padding:2px 4px');
})();
