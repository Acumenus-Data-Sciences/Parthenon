# Grafana Dashboard Styling Research Report

**Date:** 2026-03-15
**Target:** `/monitoring/grafana/provisioning/dashboards/parthenon.json`
**Grafana Version:** 11.4.0
**Purpose:** Identify every JSON property needed to make the dashboard look polished and professional.

---

## Executive Summary: What Makes It Look Ugly

After analyzing the current dashboard JSON against well-styled community dashboards (Node Exporter Full #1860, Docker monitoring dashboards #15798, #11074) and Grafana's official documentation, the dashboard suffers from these core problems:

1. **Missing `gradientMode`** on all time series panels -- flat lifeless fills
2. **Missing `lineInterpolation`** -- defaulting to angular `linear` instead of `smooth`
3. **Thin line widths** (`lineWidth: 1`) -- barely visible lines
4. **`showPoints: "auto"`** -- inconsistent point rendering instead of clean `"never"`
5. **No `axisBorderShow`/`axisColorMode`** -- missing axis visual refinement
6. **Stat panels use `colorMode: "background"`** with basic named colors -- looks flat and unfinished
7. **Gauge panels at only `h: 4`** -- too small to render arc properly; need `h: 5-6`
8. **Bar gauge `sizing: "auto"` and `namePlacement: "auto"`** -- should be explicit
9. **No panel `description`** on any panel -- no hover tooltips for context
10. **`graphTooltip: 1`** (shared crosshair) instead of `2` (shared tooltip) -- less useful
11. **No `transparent` property** -- panels have opaque backgrounds creating a "boxy" look
12. **State timeline missing `lineWidth` and `fillOpacity`** custom properties
13. **Missing `stacking.group`** property on time series panels
14. **Missing `scaleDistribution`** configuration
15. **No `axisCenteredZero`** property
16. **Missing `barAlignment: 0`** (explicit center alignment)

---

## 1. Stat Panels

**Affected panels:** #1 (Platform Status), #2 (Containers Up), #6 (Error Rate), #18 (Network Errors), #24 (Status)

### Current (Ugly)
```json
"options": {
  "colorMode": "background",
  "graphMode": "none",        // or "area"
  "textMode": "auto",
  "justifyMode": "auto",
  "orientation": "auto"
}
```

### Recommended (Polished)
```json
"options": {
  "colorMode": "background_solid",
  "graphMode": "area",
  "textMode": "value_and_name",
  "justifyMode": "center",
  "orientation": "horizontal",
  "wideLayout": true,
  "reduceOptions": {
    "calcs": ["lastNotNull"],
    "fields": "",
    "values": false
  },
  "text": {
    "titleSize": 12,
    "valueSize": 28
  },
  "percentChangeColorMode": "standard"
}
```

### Specific Changes Per Panel

| Panel | Property | Current | Change To | Reason |
|-------|----------|---------|-----------|--------|
| All stat panels | `options.colorMode` | `"background"` | `"background_solid"` | Explicit solid background, cleaner look |
| #1 Platform Status | `options.graphMode` | `"none"` | `"none"` | Keep -- status indicator doesn't need sparkline |
| #2 Containers Up | `options.graphMode` | `"area"` | `"area"` | Keep -- shows trend |
| #6 Error Rate | `options.graphMode` | `"area"` | `"area"` | Keep -- shows trend |
| #18 Network Errors | `options.graphMode` | `"none"` | `"area"` | Add sparkline for trend visibility |
| All stat panels | `options.textMode` | `"auto"` | `"value_and_name"` | Always show both for clarity |
| All stat panels | `options.justifyMode` | `"auto"` | `"center"` | Centered text looks more intentional |
| All stat panels | `options.orientation` | `"auto"` | `"horizontal"` | Consistent horizontal layout |
| All stat panels | `options.wideLayout` | (missing) | `true` | Better use of horizontal space |
| All stat panels | `options.text` | (missing) | `{"titleSize": 12, "valueSize": 28}` | Explicit sizing prevents auto-sizing inconsistency |
| All stat panels | `description` | (missing) | (add per panel) | Tooltip on hover explains the metric |

### Color Improvements for Stat Panels

Replace basic named colors with specific hex codes from Grafana's extended palette:

| Named Color | Replace With | Hex |
|-------------|-------------|-----|
| `"green"` | `"dark-green"` | `#1A7311` -- deeper, more professional |
| `"yellow"` | `"semi-dark-yellow"` | `#CC9D1C` -- less garish |
| `"red"` | `"dark-red"` | `"#AD0317"` -- more serious/clinical |

---

## 2. Gauge Panels

**Affected panels:** #3 (Host CPU), #4 (Host Memory), #5 (Host Disk), #11 (CPU Utilization), #13 (Memory Utilization)

### Current (Ugly)
```json
"options": {
  "showThresholdLabels": false,
  "showThresholdMarkers": true,
  "orientation": "auto"
},
"gridPos": { "h": 4 }       // too short for header row gauges
// "gridPos": { "h": 5 }    // for infra section gauges
```

### Recommended (Polished)
```json
"options": {
  "showThresholdLabels": false,
  "showThresholdMarkers": true,
  "orientation": "auto",
  "sizing": "auto",
  "minVizWidth": 75,
  "minVizHeight": 75,
  "reduceOptions": {
    "calcs": ["lastNotNull"],
    "fields": "",
    "values": false
  },
  "text": {
    "valueSize": 24
  }
}
```

### Specific Changes

| Panel | Property | Current | Change To | Reason |
|-------|----------|---------|-----------|--------|
| #3, #4, #5 | `gridPos.h` | `4` | `6` | Height 4 is too cramped for gauge arc + title + value |
| #11, #13 | `gridPos.h` | `5` | `6` | Slightly more room for readability |
| All gauges | `options.sizing` | (missing) | `"auto"` | Explicit auto-sizing |
| All gauges | `options.minVizWidth` | (missing) | `75` | Prevents gauge from being too tiny |
| All gauges | `options.minVizHeight` | (missing) | `75` | Prevents gauge from being too tiny |
| All gauges | `options.text` | (missing) | `{"valueSize": 24}` | Consistent value text size |
| All gauges | `description` | (missing) | (add per panel) | Hover tooltip context |

### Color Improvements for Gauge Thresholds

Use the same refined colors:
```json
"steps": [
  { "color": "#73BF69", "value": null },
  { "color": "#FF9830", "value": 70 },
  { "color": "#F2495C", "value": 85 }
]
```

These are Grafana's named palette colors (`super-light-green`, `semi-dark-orange`, `semi-dark-red`) which render better than the generic `"green"`, `"yellow"`, `"red"`.

---

## 3. Bar Gauge Panels

**Affected panels:** #9 (OOM Events), #15 (Disk Usage), #20 (CPU by Container), #21 (Memory by Container)

### Current (Ugly)
```json
"options": {
  "displayMode": "gradient",
  "showUnfilled": true,
  "valueMode": "color",
  "namePlacement": "auto",
  "sizing": "auto",
  "orientation": "horizontal"
}
```

### Recommended (Polished)
```json
"options": {
  "displayMode": "lcd",
  "showUnfilled": true,
  "valueMode": "color",
  "namePlacement": "left",
  "sizing": "manual",
  "orientation": "horizontal",
  "minVizWidth": 8,
  "minVizHeight": 16,
  "maxVizHeight": 32,
  "reduceOptions": {
    "calcs": ["lastNotNull"],
    "fields": "",
    "values": false
  },
  "text": {
    "titleSize": 11,
    "valueSize": 14
  }
}
```

### Specific Changes

| Panel | Property | Current | Change To | Reason |
|-------|----------|---------|-----------|--------|
| All bar gauges | `options.displayMode` | `"gradient"` | `"lcd"` | LCD mode is the signature polished look -- split into lit segments, looks like real hardware meters |
| All bar gauges | `options.namePlacement` | `"auto"` | `"left"` | Explicit left alignment for horizontal bars |
| All bar gauges | `options.sizing` | `"auto"` | `"manual"` | Allows control over bar dimensions |
| All bar gauges | `options.minVizHeight` | (missing) | `16` | Minimum row height for readability |
| All bar gauges | `options.maxVizHeight` | (missing) | `32` | Prevents bars from being too thick |
| All bar gauges | `options.text` | (missing) | `{"titleSize": 11, "valueSize": 14}` | Explicit text sizing |
| All bar gauges | `description` | (missing) | (add per panel) | Hover tooltip |
| All bar gauges | `fieldConfig.defaults.min` | (missing) | `0` | Explicit min for proper bar rendering |

### Alternative: Keep Gradient But Improve

If LCD feels too retro, use `"gradient"` but add `min: 0` and explicit `max` values:
```json
"fieldConfig": {
  "defaults": {
    "min": 0,
    "max": 100  // for percent-based panels
  }
}
```

---

## 4. Time Series Panels

**Affected panels:** #12 (CPU Load), #14 (Memory Swap), #16 (Disk I/O), #17 (Network Traffic), #22 (Network RX), #23 (Network TX), #25 (CPU), #26 (Memory), #27 (Network), #30 (Log Volume), #31 (Error Volume)

### Current (Ugly)
```json
"custom": {
  "lineWidth": 1,
  "fillOpacity": 10,
  "drawStyle": "line",
  "pointSize": 5,
  "showPoints": "auto",
  "stacking": { "mode": "none" },
  "spanNulls": false
}
```

### Recommended (Polished) -- Standard Line Charts
```json
"custom": {
  "axisBorderShow": false,
  "axisCenteredZero": false,
  "axisColorMode": "text",
  "axisLabel": "",
  "axisPlacement": "auto",
  "barAlignment": 0,
  "drawStyle": "line",
  "fillOpacity": 25,
  "gradientMode": "opacity",
  "hideFrom": {
    "legend": false,
    "tooltip": false,
    "viz": false
  },
  "insertNulls": false,
  "lineInterpolation": "smooth",
  "lineStyle": { "fill": "solid" },
  "lineWidth": 2,
  "pointSize": 5,
  "scaleDistribution": { "type": "linear" },
  "showPoints": "never",
  "spanNulls": false,
  "stacking": {
    "group": "A",
    "mode": "none"
  },
  "thresholdsStyle": {
    "mode": "off"
  }
}
```

### Recommended (Polished) -- Stacked Bar Charts (Log Volume, Error Volume)
```json
"custom": {
  "axisBorderShow": false,
  "axisCenteredZero": false,
  "axisColorMode": "text",
  "axisLabel": "",
  "axisPlacement": "auto",
  "barAlignment": 0,
  "drawStyle": "bars",
  "fillOpacity": 90,
  "gradientMode": "hue",
  "hideFrom": {
    "legend": false,
    "tooltip": false,
    "viz": false
  },
  "insertNulls": false,
  "lineInterpolation": "linear",
  "lineWidth": 0,
  "pointSize": 5,
  "scaleDistribution": { "type": "linear" },
  "showPoints": "never",
  "spanNulls": false,
  "stacking": {
    "group": "A",
    "mode": "normal"
  },
  "thresholdsStyle": {
    "mode": "off"
  }
}
```

### Specific Changes Summary

| Property Path | Current | Change To | Impact |
|---------------|---------|-----------|--------|
| `custom.lineWidth` | `1` | `2` | Lines are actually visible; #1860 uses 1-2, modern dashboards use 2 |
| `custom.fillOpacity` | `10` | `25` | Gives the area fill actual visual presence; Node Exporter uses 40 |
| `custom.gradientMode` | (missing) | `"opacity"` | Adds gradient fade from line to bottom -- THE biggest visual upgrade |
| `custom.lineInterpolation` | (missing) | `"smooth"` | Curved lines look modern; Node Exporter uses smooth for CPU |
| `custom.showPoints` | `"auto"` | `"never"` | Clean lines without distracting dots |
| `custom.barAlignment` | (missing) | `0` | Explicit center alignment |
| `custom.axisBorderShow` | (missing) | `false` | Clean axis without border line |
| `custom.axisColorMode` | (missing) | `"text"` | Axis labels match text color |
| `custom.axisPlacement` | (missing) | `"auto"` | Explicit placement |
| `custom.scaleDistribution` | (missing) | `{"type": "linear"}` | Explicit linear scale |
| `custom.stacking.group` | (missing) | `"A"` | Proper stacking group |
| `custom.thresholdsStyle` | (missing on most) | `{"mode": "off"}` | Explicit threshold line control |
| `custom.hideFrom` | (missing) | `{legend: false, tooltip: false, viz: false}` | Explicit visibility |
| `custom.insertNulls` | (missing) | `false` | Explicit null handling |
| `custom.lineStyle` | (missing) | `{"fill": "solid"}` | Explicit solid lines |

### For Container Detail Panels (inside collapsed row)

Panel #25 (CPU) has `thresholdsStyle: {"mode": "line"}` which is good -- shows threshold lines on the chart. Keep that but add all the other missing properties above.

### Legend Improvements

Current:
```json
"legend": {
  "showLegend": true,
  "displayMode": "list",
  "placement": "bottom"
}
```

Recommended for panels with many series (Network RX/TX by Container):
```json
"legend": {
  "showLegend": true,
  "displayMode": "table",
  "placement": "right",
  "calcs": ["mean", "max", "lastNotNull"],
  "width": 250
}
```

Recommended for panels with few series (CPU Load, Memory Swap):
```json
"legend": {
  "showLegend": true,
  "displayMode": "list",
  "placement": "bottom",
  "calcs": []
}
```

---

## 5. State Timeline Panel

**Affected panel:** #8 (Container Health Timeline)

### Current (Ugly)
```json
"options": {
  "showValue": "auto",
  "mergeValues": true,
  "alignValue": "left",
  "rowHeight": 0.8,
  "tooltip": { "mode": "single" },
  "legend": { "showLegend": false }
}
// No custom properties in fieldConfig
```

### Recommended (Polished)
```json
"options": {
  "showValue": "auto",
  "mergeValues": true,
  "alignValue": "center",
  "rowHeight": 0.75,
  "tooltip": {
    "mode": "single",
    "sort": "none"
  },
  "legend": {
    "showLegend": false
  }
},
"fieldConfig": {
  "defaults": {
    "custom": {
      "lineWidth": 1,
      "fillOpacity": 80
    },
    "color": {
      "mode": "thresholds"
    }
  }
}
```

### Specific Changes

| Property | Current | Change To | Reason |
|----------|---------|-----------|--------|
| `options.alignValue` | `"left"` | `"center"` | Centered text looks better in timeline blocks |
| `options.rowHeight` | `0.8` | `0.75` | Slight spacing between rows for visual separation |
| `fieldConfig.defaults.custom.lineWidth` | (missing) | `1` | Adds subtle border between timeline segments |
| `fieldConfig.defaults.custom.fillOpacity` | (missing) | `80` | Rich fill without being fully opaque |
| `options.tooltip.sort` | (missing) | `"none"` | Explicit sort control |
| `gridPos.h` | `8` | `8` | Keep -- good height for 16+ containers |

---

## 6. Logs Panels

**Affected panels:** #28 (Logs -- per container), #32 (Log Stream)

### Current
```json
"options": {
  "dedupStrategy": "signature",
  "enableLogDetails": true,
  "prettifyLogMessage": false,
  "showCommonLabels": false,
  "showLabels": true,
  "showTime": true,
  "sortOrder": "Descending",
  "wrapLogMessage": true
}
```

### Recommended (Polished)
```json
"options": {
  "dedupStrategy": "signature",
  "enableLogDetails": true,
  "prettifyLogMessage": true,
  "showCommonLabels": false,
  "showLabels": false,
  "showTime": true,
  "sortOrder": "Descending",
  "wrapLogMessage": true,
  "showControls": true,
  "enableInfiniteScrolling": true,
  "fontSize": "default"
}
```

### Specific Changes

| Property | Current | Change To | Reason |
|----------|---------|-----------|--------|
| `prettifyLogMessage` | `false` | `true` | JSON logs render readable instead of single-line blobs |
| `showLabels` | `true` | `false` | Labels clutter the view; use log details expansion instead |
| `showControls` | (missing) | `true` | Navigation and filtering controls |
| `enableInfiniteScrolling` | (missing) | `true` | Better UX for browsing logs |
| `fontSize` | (missing) | `"default"` | Explicit font size |
| `description` | (missing) | (add) | Panel description |

---

## 7. Dashboard-Level Settings

### Current
```json
{
  "graphTooltip": 1,
  "liveNow": false,
  "style": (missing),
  "links": [],
  "annotations": { "list": [] }
}
```

### Recommended
```json
{
  "graphTooltip": 2,
  "liveNow": true,
  "style": "dark",
  "links": [
    {
      "title": "Prometheus",
      "url": "https://parthenon.acumenus.net/prometheus",
      "icon": "external link",
      "targetBlank": true,
      "type": "link"
    },
    {
      "title": "Loki Explore",
      "url": "https://parthenon.acumenus.net/grafana/explore",
      "icon": "external link",
      "targetBlank": true,
      "type": "link"
    }
  ],
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": { "type": "grafana", "uid": "-- Grafana --" },
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  }
}
```

### Specific Changes

| Property | Current | Change To | Reason |
|----------|---------|-----------|--------|
| `graphTooltip` | `1` | `2` | Shared tooltip shows values from all panels at crosshair time -- much more useful than just crosshair |
| `liveNow` | `false` | `true` | Auto-scroll to current time for a monitoring dashboard |
| `style` | (missing) | `"dark"` | Explicit dark theme |
| `links` | `[]` | (add nav links) | Quick links to Prometheus, Loki Explore |
| `annotations.list` | `[]` | (add built-in) | Enable annotation overlay for deploy markers |

---

## 8. Panel Descriptions (Add to ALL Panels)

Every panel should have a `description` field. This shows as a tooltip when hovering the info icon.

| Panel | Suggested Description |
|-------|----------------------|
| #1 Platform Status | `"Overall platform health based on running container count. GREEN (18+) = all services healthy, YELLOW (15-17) = degraded, RED (<15) = critical."` |
| #2 Containers Up | `"Number of Parthenon Docker containers currently running with active memory allocation."` |
| #3 Host CPU | `"Host CPU utilization percentage averaged across all cores."` |
| #4 Host Memory | `"Host physical memory utilization percentage (MemTotal - MemAvailable)."` |
| #5 Host Disk | `"Root filesystem disk usage percentage."` |
| #6 Error Rate | `"Count of log lines matching 'error' across all containers in the current interval."` |
| #8 Container Health | `"Timeline showing container up/down state. Green = running, Red = stopped/crashed."` |
| #9 OOM Events | `"Out-of-memory kill events per container in the last 24 hours."` |
| #12 CPU Load | `"System load averages (1m, 5m, 15m). Values above CPU core count indicate saturation."` |
| #14 Memory Swap | `"Swap space utilization. Non-zero swap usage may indicate memory pressure."` |
| #15 Disk Usage | `"Disk usage per filesystem (excluding tmpfs and overlay)."` |
| #16 Disk I/O | `"Disk read and write throughput rates."` |
| #17 Network Traffic | `"Physical interface network throughput (excluding loopback, veth, docker bridges)."` |
| #18 Network Errors | `"Total network receive + transmit errors in the current interval."` |
| #20 CPU by Container | `"CPU usage percentage per Parthenon container."` |
| #21 Memory by Container | `"Working set memory per Parthenon container."` |

---

## 9. Grid Layout Improvements

### Current Issues
- Top row gauges at `h: 4` are cramped
- Some panels are inconsistently sized

### Recommended Grid Changes

| Panel | Current gridPos | Recommended gridPos | Reason |
|-------|----------------|--------------------:|--------|
| #1 Platform Status | `w:4, h:4` | `w:4, h:6` | More room for stat display |
| #2 Containers Up | `w:4, h:4` | `w:4, h:6` | Match row height |
| #3 Host CPU | `w:4, h:4` | `w:4, h:6` | Gauge needs vertical space for arc |
| #4 Host Memory | `w:4, h:4` | `w:4, h:6` | Match |
| #5 Host Disk | `w:4, h:4` | `w:4, h:6` | Match |
| #6 Error Rate | `w:4, h:4` | `w:4, h:6` | Match row height |
| #7 Row (Container Status) | `y:4` | `y:6` | Shift down for taller top row |
| #8 Container Health | `w:16, h:8` | `w:16, h:8` | Keep |
| #9 OOM Events | `w:8, h:8` | `w:8, h:8` | Keep |

All subsequent `y` positions need to shift by +2 to accommodate the taller top row.

---

## 10. Color Palette Consistency

### Problem
The dashboard uses generic color names (`"green"`, `"yellow"`, `"red"`) which resolve to Grafana's default palette colors. These look flat and unsophisticated.

### Solution: Use Grafana's Extended Named Colors

For threshold steps, use these instead:

| Purpose | Current | Recommended | Notes |
|---------|---------|-------------|-------|
| OK/Healthy | `"green"` | `"#73BF69"` or `"super-light-green"` | Softer, easier on eyes |
| Warning | `"yellow"` | `"#FF9830"` or `"orange"` | Orange reads better than yellow on dark backgrounds |
| Critical | `"red"` | `"#F2495C"` or `"semi-dark-red"` | More refined red |
| Base/null step | `"green"` | `"#73BF69"` | Consistent |

### For Time Series Color Mode

Current panels use `"palette-classic"` which is fine. No change needed.

---

## 11. Summary of Missing Properties (Quick Reference)

### Properties to ADD to every time series panel's `fieldConfig.defaults.custom`:
```
gradientMode: "opacity"
lineInterpolation: "smooth"
axisBorderShow: false
axisColorMode: "text"
axisPlacement: "auto"
barAlignment: 0
scaleDistribution: { type: "linear" }
hideFrom: { legend: false, tooltip: false, viz: false }
insertNulls: false
lineStyle: { fill: "solid" }
thresholdsStyle: { mode: "off" }
stacking.group: "A"
```

Change on every time series panel:
```
lineWidth: 1 -> 2
fillOpacity: 10 -> 25
showPoints: "auto" -> "never"
```

### Properties to ADD to every stat panel's `options`:
```
wideLayout: true
text: { titleSize: 12, valueSize: 28 }
justifyMode: "center"
orientation: "horizontal"
```

### Properties to ADD to every gauge panel's `options`:
```
sizing: "auto"
minVizWidth: 75
minVizHeight: 75
text: { valueSize: 24 }
```

### Properties to ADD to every bar gauge panel's `options`:
```
displayMode: "lcd"       // change from "gradient"
namePlacement: "left"    // change from "auto"
text: { titleSize: 11, valueSize: 14 }
minVizHeight: 16
maxVizHeight: 32
```

Add `min: 0` to every bar gauge `fieldConfig.defaults`.

### Properties to ADD to every panel (all types):
```
description: "<contextual description>"
```

### Dashboard-level changes:
```
graphTooltip: 2          // change from 1
liveNow: true            // change from false
style: "dark"            // add
links: [...]             // add navigation links
```

---

## 12. Priority Order for Implementation

1. **HIGH IMPACT, LOW EFFORT:** Add `gradientMode: "opacity"` and `lineInterpolation: "smooth"` to all time series panels -- single biggest visual improvement
2. **HIGH IMPACT, LOW EFFORT:** Change `lineWidth` to 2 and `fillOpacity` to 25 on all time series
3. **HIGH IMPACT, LOW EFFORT:** Change bar gauge `displayMode` to `"lcd"`
4. **MEDIUM IMPACT:** Increase top row `gridPos.h` from 4 to 6
5. **MEDIUM IMPACT:** Add all missing `custom` properties to time series panels
6. **MEDIUM IMPACT:** Add `text` sizing to stat/gauge/bar gauge panels
7. **MEDIUM IMPACT:** Change `graphTooltip` to 2
8. **LOW IMPACT:** Add `description` to all panels
9. **LOW IMPACT:** Refine threshold colors to hex values
10. **LOW IMPACT:** Add dashboard links and annotations
