/* ----------  map ---------- */
const map = L.map("map").setView([20, 0], 2);
const tiles = {
  osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OSM",
  }),
  carto: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { attribution: "© CartoDB" },
  ),
  satellite: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "© Esri" },
  ),
};
tiles.osm.addTo(map);
document.getElementById("tileSelect").addEventListener("change", (e) => {
  Object.values(tiles).forEach((l) => map.removeLayer(l));
  tiles[e.target.value].addTo(map);
});
const clusters = L.markerClusterGroup({ maxClusterRadius: 40 });
map.addLayer(clusters);
let places = [],
  originalLines = [];

/* ----------  theme ---------- */
const themeBtn = document.getElementById("themeToggle");
themeBtn.onclick = () => {
  const dark = !(document.body.dataset.theme === "dark");
  document.body.dataset.theme = dark ? "dark" : "";
  themeBtn.textContent = dark ? "☀️" : "🌙";
  localStorage.setItem("theme", dark ? "dark" : "");
};
document.body.dataset.theme = localStorage.getItem("theme") || "";

/* ----------  progress ---------- */
const pg = document.getElementById("progress");
const bar = document.getElementById("progressBar");
const pctText = pg.querySelector("span");
function showProgress(pct) {
  const p = Math.round(pct);
  bar.style.width = p + "%";
  pctText.textContent = p + "%";
  pg.style.display = p === 100 ? "none" : "block";
}

/* ----------  file ---------- */
document.getElementById("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  console.clear();
  console.time("load");
  const text = await file.text();
  originalLines = text.split(/\r?\n/);
  parseGedcom(originalLines);
  await geocodeAll();
  console.timeEnd("load");
});

/* ----------  parser ---------- */
function parseGedcom(lines) {
  places = [];
  let placCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d+)\s+PLAC\s+(.+)/);
    if (!m) continue;
    placCount++;
    const level = +m[1],
      place = m[2].trim();
    let events = [],
      owner = "";
    let back = i - 1;
    while (back >= 0 && !/^\d\s+\w+/.test(lines[back])) back--;
    if (back >= 0) {
      const tag = RegExp.$1;
      let look = back - 1;
      while (look >= 0 && !/^0\s+(@[^@]+@)\s+(INDI|FAM)/.test(lines[look]))
        look--;
      if (look >= 0) {
        const id = RegExp.$1,
          type = RegExp.$2;
        owner = getName(lines, look + 1, type);
        events.push({ tag, owner, id });
      }
    }
    const dup = places.find((p) => p.name === place);
    if (dup) {
      dup.events.push(...events);
      continue;
    }
    places.push({
      name: place,
      events,
      lat: null,
      lon: null,
      lineIndex: i,
      level,
    });
  }
  console.log(`PLAC lines:${placCount}, unique:${places.length}`);
}
function getName(lines, start, type) {
  for (let i = start; i < lines.length && !/^0\s/.test(lines[i]); i++) {
    const m = lines[i].match(/^\d\s+NAME\s+(.+)/);
    if (m) return m[1].trim();
  }
  return type === "INDI" ? "Unknown Person" : "Unknown Family";
}

/* ----------  geocode ---------- */
async function geocodeAll() {
  const todo = places.filter((p) => p.lat === null);
  showProgress(0);
  for (let i = 0; i < todo.length; i++) {
    const p = todo[i];
    try {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/search?format=json&q=" +
          encodeURIComponent(p.name) +
          "&limit=1",
      );
      const json = await res.json();
      if (json.length) {
        p.lat = +json[0].lat;
        p.lon = +json[0].lon;
      }
    } catch (e) {
      console.error(p.name, e);
    }
    showProgress(((i + 1) / todo.length) * 100);
    await new Promise((r) => setTimeout(r, 1100));
  }
  showProgress(100);
  places.forEach(addOrUpdateMarker);
  updateOrphanList();
}

/* ----------  markers ---------- */
function addOrUpdateMarker(p) {
  if (p.lat == null) return;

  function buildPopup() {
    return `
      <strong>${p.name}</strong>
      <ul>${p.events.map((e) => `<li>${e.tag} – ${e.owner} (${e.id})</li>`).join("")}</ul>
      <div class="coords">📍 ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</div>`;
  }

  const m = L.marker([p.lat, p.lon], { draggable: true }).bindPopup(
    buildPopup(),
  );

  m.on("dragend", (e) => {
    const newLatLng = e.target.getLatLng();
    p.lat = newLatLng.lat;
    p.lon = newLatLng.lng;
    // rebuild popup so coordinates update
    e.target.setPopupContent(buildPopup());
    updateOrphanList();
  });
  clusters.addLayer(m);
  p.marker = m;
}
/* ----------  orphan list ---------- */
function updateOrphanList() {
  const bad = places.filter((p) => p.lat == null);
  const list = document.getElementById("orphansList");
  list.innerHTML = bad.map((p) => `<li>${p.name}</li>`).join("");
}

/* ----------  exports ---------- */
function exportGeoJson() {
  download(
    JSON.stringify(
      {
        type: "FeatureCollection",
        features: places
          .filter((p) => p.lat != null)
          .map((p) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lon, p.lat] },
            properties: { name: p.name, events: p.events },
          })),
      },
      null,
      2,
    ),
    "places.geojson",
    "application/json",
  );
}
function exportGedcomWithCoords() {
  if (!originalLines.length) {
    alert("No GEDCOM loaded");
    return;
  }
  const out = [...originalLines];
  places
    .filter((p) => p.lat != null)
    .sort((a, b) => b.lineIndex - a.lineIndex)
    .forEach((p) => {
      const idx = p.lineIndex,
        level = p.level,
        indent = " ".repeat(level + 1);
      let s = idx + 1,
        e = s;
      while (e < out.length && +out[e].match(/^\s*(\d+)/)[1] > level) e++;
      out.splice(s, e - s);
      out.splice(
        s,
        0,
        `${indent}MAP`,
        `${indent}1 LATI ${p.lat.toFixed(6)}`,
        `${indent}1 LONG ${p.lon.toFixed(6)}`,
      );
    });
  download(out.join("\r\n"), "corrected.ged", "text/plain");
}
function download(text, name, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
