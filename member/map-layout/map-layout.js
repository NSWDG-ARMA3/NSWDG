const MAP_WIDTH = 1672;
const MAP_HEIGHT = 941;

const zones = [
  {
    id: "a10",
    code: "A10",
    name: "Firing Range",
    description: "Large western firing range.",
    points: "95,145 275,75 515,82 560,165 567,455 115,455 95,385"
  },
  {
    id: "a9c",
    code: "A9C",
    name: "A9C CQB Block",
    description: "North-west CQB block.",
    points: "616,95 707,95 707,210 616,210"
  },
  {
    id: "a9d",
    code: "A9D",
    name: "A9D CQB Block",
    description: "North-central CQB block.",
    points: "707,95 773,95 773,210 707,210"
  },
  {
    id: "a9b",
    code: "A9B",
    name: "A9B Structure",
    description: "Western internal A9 structure.",
    points: "616,210 742,210 742,315 616,315"
  },
  {
    id: "a9a",
    code: "A9A",
    name: "A9A Structure",
    description: "Southern A9 structure.",
    points: "616,315 760,315 760,382 616,382"
  },
  {
    id: "a8",
    code: "A8",
    name: "A8",
    description: "Central training structure.",
    points: "784,309 891,309 891,340 784,340"
  },
  {
    id: "a7",
    code: "A7",
    name: "A7",
    description: "Small eastern training structure.",
    points: "971,247 1049,247 1049,274 971,274"
  },
  {
    id: "a6",
    code: "A6",
    name: "A6",
    description: "South-west compound building.",
    points: "655,368 736,368 736,504 655,504"
  },
  {
    id: "a5",
    code: "A5",
    name: "A5",
    description: "Main central building block.",
    points: "784,360 970,360 970,457 784,457"
  },
  {
    id: "a4a",
    code: "A4A",
    name: "A4A",
    description: "Central-west training lane.",
    points: "310,510 780,510 820,575 520,615 285,585"
  },
  {
    id: "a4b",
    code: "A4B",
    name: "A4B",
    description: "Western small compound.",
    points: "150,480 300,480 300,560 150,560"
  },
  {
    id: "a3b",
    code: "A3B",
    name: "A3B",
    description: "South-west parking and lane area.",
    points: "160,640 520,640 520,815 160,815"
  },
  {
    id: "a3a",
    code: "A3A",
    name: "A3A",
    description: "Southern long training lane.",
    points: "520,640 855,640 855,820 520,820"
  },
  {
    id: "b1",
    code: "B1",
    name: "Killhouse B1",
    description: "Central-south killhouse.",
    points: "1015,495 1088,495 1088,695 985,695 955,610 980,495"
  },
  {
    id: "a1",
    code: "A1",
    name: "A1",
    description: "Eastern open training area.",
    points: "1102,318 1275,318 1275,540 1102,540"
  },
  {
    id: "a2",
    code: "A2",
    name: "A2",
    description: "South-east training area.",
    points: "1100,558 1248,558 1248,805 1100,805"
  },
  {
    id: "b2",
    code: "B2",
    name: "Killhouse B2",
    description: "South-east killhouse.",
    points: "1025,745 1248,745 1248,800 1025,800"
  },
  {
    id: "b3",
    code: "B3",
    name: "Killhouse B3",
    description: "North-east killhouse complex.",
    points: "1075,82 1285,82 1285,225 1075,225"
  }
];

const viewport = document.getElementById("map-viewport");
const stage = document.getElementById("map-stage");
const overlay = document.getElementById("map-overlay");
const zoomLabel = document.getElementById("zoom-label");

const selectedCode = document.getElementById("selected-code");
const selectedName = document.getElementById("selected-name");
const selectedDescription = document.getElementById("selected-description");
const zoneList = document.getElementById("zone-list");

let scale = 0.62;
let translateX = 20;
let translateY = 20;

let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let startX = 0;
let startY = 0;
let selectedZoneId = null;

function applyTransform() {
  stage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

function clampScale(value) {
  return Math.max(0.25, Math.min(5, value));
}

function setInfo(zone) {
  selectedCode.textContent = zone.code;
  selectedName.textContent = zone.name;
  selectedDescription.textContent = zone.description;
}

function clearInfo() {
  selectedCode.textContent = "None selected";
  selectedName.textContent = "Hover or click an area.";
  selectedDescription.textContent = "Mouse wheel zooms. Drag pans the map.";
}

function selectZone(zoneId) {
  selectedZoneId = zoneId;

  const zone = zones.find(item => item.id === zoneId);
  if (!zone) return;

  setInfo(zone);

  document.querySelectorAll(".map-zone").forEach(element => {
    element.classList.toggle("selected", element.dataset.zoneId === zoneId);
  });
}

function clearSelection() {
  selectedZoneId = null;

  document.querySelectorAll(".map-zone").forEach(element => {
    element.classList.remove("selected");
  });

  clearInfo();
}

function renderZones() {
  overlay.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  overlay.innerHTML = "";
  zoneList.innerHTML = "";

  zones.forEach(zone => {
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");

    polygon.setAttribute("points", zone.points);
    polygon.setAttribute("class", "map-zone");
    polygon.dataset.zoneId = zone.id;

    polygon.addEventListener("mouseenter", () => {
      setInfo(zone);
    });

    polygon.addEventListener("mouseleave", () => {
      if (!selectedZoneId) {
        clearInfo();
      } else {
        const selectedZone = zones.find(item => item.id === selectedZoneId);
        if (selectedZone) setInfo(selectedZone);
      }
    });

    polygon.addEventListener("click", event => {
      event.stopPropagation();
      selectZone(zone.id);
    });

    overlay.appendChild(polygon);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${zone.code} - ${zone.name}`;
    button.addEventListener("click", () => {
      selectZone(zone.id);
      centerZone(zone);
    });

    zoneList.appendChild(button);
  });
}

function zoomAt(clientX, clientY, nextScale) {
  const rect = viewport.getBoundingClientRect();

  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  const mapX = (mouseX - translateX) / scale;
  const mapY = (mouseY - translateY) / scale;

  scale = clampScale(nextScale);

  translateX = mouseX - mapX * scale;
  translateY = mouseY - mapY * scale;

  applyTransform();
}

function resetMap() {
  const rect = viewport.getBoundingClientRect();

  scale = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT) * 0.96;
  scale = clampScale(scale);

  translateX = (rect.width - MAP_WIDTH * scale) / 2;
  translateY = (rect.height - MAP_HEIGHT * scale) / 2;

  applyTransform();
}

function centerZone(zone) {
  const coords = zone.points
    .trim()
    .split(" ")
    .map(pair => pair.split(",").map(Number));

  const xs = coords.map(pair => pair[0]);
  const ys = coords.map(pair => pair[1]);

  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

  const rect = viewport.getBoundingClientRect();

  scale = Math.max(scale, 1.15);
  scale = clampScale(scale);

  translateX = rect.width / 2 - centerX * scale;
  translateY = rect.height / 2 - centerY * scale;

  applyTransform();
}

viewport.addEventListener("wheel", event => {
  event.preventDefault();

  const nextScale = event.deltaY < 0 ? scale * 1.15 : scale / 1.15;
  zoomAt(event.clientX, event.clientY, nextScale);
}, { passive: false });

viewport.addEventListener("mousedown", event => {
  dragging = true;
  viewport.classList.add("dragging");

  dragStartX = event.clientX;
  dragStartY = event.clientY;
  startX = translateX;
  startY = translateY;
});

window.addEventListener("mousemove", event => {
  if (!dragging) return;

  translateX = startX + event.clientX - dragStartX;
  translateY = startY + event.clientY - dragStartY;

  applyTransform();
});

window.addEventListener("mouseup", () => {
  dragging = false;
  viewport.classList.remove("dragging");
});

viewport.addEventListener("click", () => {
  clearSelection();
});

document.getElementById("zoom-in").addEventListener("click", () => {
  const rect = viewport.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scale * 1.2);
});

document.getElementById("zoom-out").addEventListener("click", () => {
  const rect = viewport.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scale / 1.2);
});

document.getElementById("reset-map").addEventListener("click", () => {
  resetMap();
});

window.addEventListener("resize", () => {
  resetMap();
});

renderZones();
resetMap();