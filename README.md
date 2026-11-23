# Sweet Floor Card

Dollhouse dashboard card for Home Assistant: day/night sky, sun moving east to west, rooms that light up,
animated people, plus Energy and Gas from the built-in Energy dashboard.

## Install
**Marketplace (Home Assistant 2026.11+):** Settings > Marketplace > Add from link > `YOUR_GITHUB_USER/sweet-floor-card`, type **Dashboard** > Install > reload the browser.

**HACS (older):** Custom repositories, type **Dashboard**, then Download.

**Manual:** copy `sweet-floor-card.js` to `/config/www/`, add resource `/local/sweet-floor-card.js` (JavaScript module), reload.

## Use
```yaml
type: custom:sweet-floor-card
title: Sweet Home
```
See `dashboard-example.yaml` for all options. Open `preview.html` to try it with mock data.
