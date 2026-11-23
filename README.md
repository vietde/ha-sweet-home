# Sweet Floor Card

One file, no dependencies, no restart: a dollhouse dashboard for Home Assistant.

## Install (2 minutes)
1. Copy `sweet-floor-card.js` to `/config/www/` (create `www` if missing).
2. Settings > Dashboards > ⋮ > **Resources** > Add: URL `/local/sweet-floor-card.js?v=1`, type **JavaScript module**.
   (Enable *Advanced mode* in your profile if you don't see Resources.)
3. Hard-refresh the browser (Ctrl+Shift+R; on the app: Settings > Companion app > Debugging > Reset frontend cache).
4. Edit dashboard > Add card > Manual > `type: custom:sweet-floor-card`.
   Use a **Panel (1 card)** view for full screen.

Try it without HA: open `preview.html` in a browser (mock data, time-of-day slider).

## What it does
- **Day/night** follows `sun.sun` elevation (clock fallback). Sky, house, UI colours fade through dawn/dusk.
- **Sun** travels east (left) to west (right) using real azimuth/elevation; moon + stars at night; weather rain/snow/clouds.
- **Rooms light up** for lights (real colour/brightness), TVs (blue flicker) and any other device that is on; the device ring pulses.
- **People**: avatar glows and ripples in the room with motion/occupancy/presence; header avatars glow when home.
- **Energy + Gas** use the built-in Energy dashboard (grid, solar, battery, gas, top devices). Gas shows today, this hour, 24h and 7-day charts.
- Tap a device = toggle; tap a room = controls sheet; long-press = more-info.

## Setup rules
- Rooms = Areas, floors = Floors. Devices need an Area (entity or its device).
- Presence needs `binary_sensor` with device class motion/occupancy/presence.
- Energy: configure Settings > Dashboards > Energy once. The card needs no extra sensors.

## Blank card troubleshooting
The card now shows an error box instead of nothing. If the area is empty/“Custom element doesn't exist”:
resource missing or wrong URL (check `/local/...` opens in browser), type not `module`, cache not cleared, or `type:` lacks `custom:`.
