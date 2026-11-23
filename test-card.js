const fs = require('fs');

// Create mock browser DOM environment
global.window = global;
global.CustomEvent = class CustomEvent {
  constructor(type, params) {
    this.type = type;
    this.detail = params ? params.detail : null;
  }
};
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

class MockElement {
  constructor(tag) {
    this.tagName = (tag || 'DIV').toUpperCase();
    this.style = {
      _props: {},
      setProperty(k, v) { this._props[k] = v; },
      getProperty(k) { return this._props[k]; }
    };
    this.classList = {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c, on) { if (on === undefined) on = !this._classes.has(c); if (on) this._classes.add(c); else this._classes.delete(c); return on; },
      contains(c) { return this._classes.has(c); }
    };
    this.attributes = {};
    this.children = [];
    this.parentElement = null;
    this._innerHTML = '';
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  hasAttribute(k) { return this.attributes[k] !== undefined; }
  removeAttribute(k) { delete this.attributes[k]; }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) this.children.splice(idx, 1);
    child.parentElement = null;
    return child;
  }
  remove() {
    if (this.parentElement) this.parentElement.removeChild(this);
  }
  insertBefore(newChild, refChild) {
    const idx = this.children.indexOf(refChild);
    if (idx >= 0) this.children.splice(idx, 0, newChild);
    else this.children.push(newChild);
    newChild.parentElement = this;
    return newChild;
  }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = val;
    // create dummy children for querySelector
    this.children = [];
  }
  querySelector(sel) {
    return new MockElement(sel.replace(/[^a-zA-Z0-9_-]/g, ''));
  }
  querySelectorAll(sel) {
    return [new MockElement('div'), new MockElement('div')];
  }
  getBoundingClientRect() { return { width: 400, height: 300, top: 0, left: 0 }; }
}

global.document = {
  createElement(tag) { return new MockElement(tag); }
};

global.customElements = {
  _defs: {},
  define(tag, cls) { this._defs[tag] = cls; },
  get(tag) { return this._defs[tag]; }
};

global.HTMLElement = class extends MockElement {
  constructor() {
    super('SWEET-FLOOR-CARD');
    this.shadowRoot = new MockElement('SHADOW-ROOT');
  }
  attachShadow() { return this.shadowRoot; }
};

// Load sweet-floor-card.js
const code = fs.readFileSync('sweet-floor-card.js', 'utf8');
eval(code);

console.log('Testing custom card instantiation...');
const CardClass = global.customElements.get('sweet-floor-card');
if (!CardClass) {
  console.error('FAIL: sweet-floor-card not defined in customElements!');
  process.exit(1);
}

const card = new CardClass();
card.setConfig({
  title: 'Test House',
  preview_hour: 12
});

const mockHass = {
  states: {
    'sun.sun': { state: 'above_horizon', attributes: { elevation: 45, azimuth: 180 } },
    'weather.home': { state: 'sunny', attributes: { temperature: 22, temperature_unit: '°C' } },
    'person.alex': { state: 'home', attributes: { friendly_name: 'Alex' } },
    'light.living_room_ceiling': { state: 'on', attributes: { brightness: 255, color_mode: 'color_temp', color_temp_kelvin: 2700 } },
    'media_player.living_room_tv': { state: 'on', attributes: { device_class: 'tv' } },
    'binary_sensor.living_room_motion': { state: 'on', last_changed: new Date().toISOString() },
    'sensor.grid_power': { state: '450', attributes: { unit_of_measurement: 'W', device_class: 'power' } },
    'sensor.solar_power': { state: '3200', attributes: { unit_of_measurement: 'W', device_class: 'power' } },
    'sensor.gas_meter': { state: '1420.5', attributes: { unit_of_measurement: 'm³', device_class: 'gas' } }
  },
  config: { unit_system: { temperature: '°C' } },
  callWS(msg) {
    if (msg.type === 'config/area_registry/list') {
      return Promise.resolve([
        { area_id: 'living_room', name: 'Living Room', floor_id: 'ground' },
        { area_id: 'bedroom', name: 'Bedroom', floor_id: 'upstairs' }
      ]);
    }
    if (msg.type === 'config/floor_registry/list') {
      return Promise.resolve([
        { floor_id: 'ground', name: 'Ground Floor', level: 0 },
        { floor_id: 'upstairs', name: 'Upstairs', level: 1 }
      ]);
    }
    if (msg.type === 'config/device_registry/list') return Promise.resolve([]);
    if (msg.type === 'config/entity_registry/list') {
      return Promise.resolve([
        { entity_id: 'light.living_room_ceiling', area_id: 'living_room' },
        { entity_id: 'media_player.living_room_tv', area_id: 'living_room' },
        { entity_id: 'binary_sensor.living_room_motion', area_id: 'living_room' }
      ]);
    }
    if (msg.type === 'energy/get_prefs') {
      return Promise.resolve({
        energy_sources: [
          { type: 'grid', power: [{ stat_rate: 'sensor.grid_power' }] },
          { type: 'solar', stat_rate: 'sensor.solar_power' },
          { type: 'gas', stat_energy_from: 'sensor.gas_meter' }
        ]
      });
    }
    return Promise.resolve({});
  },
  callService() { return Promise.resolve(); }
};

card.hass = mockHass;
console.log('card.hass assigned successfully.');

// Test day/night cycle calculations
card.setConfig({ title: 'Test House', preview_hour: 6 }); // Sunrise
card.hass = mockHass;
console.log('Sunrise hour 6 ok. env:', card._env.az, card._env.sunX.toFixed(1) + '%');

card.setConfig({ title: 'Test House', preview_hour: 12 }); // Noon
card.hass = mockHass;
console.log('Noon hour 12 ok. env:', card._env.az, card._env.sunX.toFixed(1) + '%');

card.setConfig({ title: 'Test House', preview_hour: 18 }); // Sunset
card.hass = mockHass;
console.log('Sunset hour 18 ok. env:', card._env.az, card._env.sunX.toFixed(1) + '%');

card.setConfig({ title: 'Test House', preview_hour: 23 }); // Night
card.hass = mockHass;
console.log('Night hour 23 ok. night factor:', card._env.night.toFixed(2));

// Test tab switching
card._setTab('energy');
console.log('Switched to energy tab, ok.');
card._setTab('climate');
console.log('Switched to climate tab, ok.');
card._setTab('security');
console.log('Switched to security tab, ok.');
card._setTab('home');
console.log('Switched to home tab, ok.');

console.log('ALL UNIT TESTS PASSED SUCCESSFULLY!');
