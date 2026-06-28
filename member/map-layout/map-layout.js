const MAP_WIDTH = 1672;
const MAP_HEIGHT = 941;

const zones = [
  {
    id: "new_marker",
    code: "NEW",
    name: "New Marker",
    description: "Describe this location.",
    type: "Facility",
    x: 1344,
    y: 282,
    radius: 24
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

const zoomInButton = document.getElementById("zoom-in");
const zoomOutButton = document.getElementById("zoom-out");
const resetMapButton = document.getElementById("reset-map");
const pickPointButton = document.getElementById("pick-point");

let scale = 0.62;
let translateX = 20;
let translateY = 20;

let dragging = false;
let didDrag = false;
let pickMode = false;

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
  return Math.max(0.25, Math.min(6, value));
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

function copyMarkerCode(x, y) {
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);

  const markerCode = `{
  id: "new_marker",
  code: "NEW",
  name: "New Marker",
  description: "Describe this location.",
  type: "Facility",
  x: ${roundedX},
  y: ${roundedY},
  radius: 24
}`;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(markerCode)
      .then(() => {
        alert(`Marker copied to clipboard.\n\nx: ${roundedX}, y: ${roundedY}`);
      })
      .catch(() => {
        window.prompt("Copy this marker code:", markerCode);
      });

    return;
  }

  window.prompt("Copy this marker code:", markerCode);
}

function selectZone(zoneId) {
  selectedZoneId = zoneId;

  const zone = zones.find(item => item.id === zoneId);
  if (!zone) return;

  setInfo(zone);

  document.querySelectorAll(".map-zone").forEach(element => {
    element.classList.toggle("selected", element.dataset.zoneId === zoneId);
  });

  centerZone(zone);
}

function clearSelection() {
  selectedZoneId = null;

  document.querySelectorAll(".map-zone").forEach(element => {
    element.classList.remove("selected");
  });

  clearInfo();
}

function restoreInfoAfterHover() {
  if (!selectedZoneId) {
    clearInfo();
    return;
  }

  const selectedZone = zones.find(item => item.id === selectedZoneId);
  if (selectedZone) setInfo(selectedZone);
}

function renderZones() {
  overlay.setAttribute("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  overlay.innerHTML = "";
  zoneList.innerHTML = "";

  zones.forEach(zone => {
    const markerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    markerGroup.classList.add("map-marker-group");
    markerGroup.dataset.zoneId = zone.id;

    const pulse = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pulse.setAttribute("cx", zone.x);
    pulse.setAttribute("cy", zone.y);
    pulse.setAttribute("r", zone.radius + 10);
    pulse.setAttribute("class", "map-zone-pulse");

    const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    marker.setAttribute("cx", zone.x);
    marker.setAttribute("cy", zone.y);
    marker.setAttribute("r", zone.radius);
    marker.setAttribute("class", "map-zone");
    marker.dataset.zoneId = zone.id;

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", zone.x);
    dot.setAttribute("cy", zone.y);
    dot.setAttribute("r", 5);
    dot.setAttribute("class", "map-zone-dot");

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", zone.x + zone.radius + 8);
    label.setAttribute("y", zone.y + 5);
    label.setAttribute("class", "map-zone-label");
    label.textContent = zone.name;

    markerGroup.addEventListener("mouseenter", () => {
      setInfo(zone);
      marker.classList.add("hovered");
    });

    markerGroup.addEventListener("mouseleave", () => {
      marker.classList.remove("hovered");
      restoreInfoAfterHover();
    });

    markerGroup.addEventListener("click", event => {
      event.stopPropagation();

      if (pickMode) return;

      selectZone(zone.id);
    });

    markerGroup.appendChild(pulse);
    markerGroup.appendChild(marker);
    markerGroup.appendChild(dot);
    markerGroup.appendChild(label);

    overlay.appendChild(markerGroup);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${zone.code} - ${zone.name}`;
    button.addEventListener("click", () => {
      if (pickMode) return;
      selectZone(zone.id);
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
  const rect = viewport.getBoundingClientRect();

  scale = Math.max(scale, 1.8);
  scale = clampScale(scale);

  translateX = rect.width / 2 - zone.x * scale;
  translateY = rect.height / 2 - zone.y * scale;

  applyTransform();
}

function getMapCoordinates(event) {
  const rect = viewport.getBoundingClientRect();

  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  return {
    x: (mouseX - translateX) / scale,
    y: (mouseY - translateY) / scale
  };
}

function setPickMode(enabled) {
  pickMode = enabled;
  pickPointButton.classList.toggle("active", pickMode);
  viewport.classList.toggle("pick-mode", pickMode);
  pickPointButton.textContent = pickMode ? "Pick Point: ON" : "Pick Point";
}

viewport.addEventListener("wheel", event => {
  event.preventDefault();

  const nextScale = event.deltaY < 0 ? scale * 1.15 : scale / 1.15;
  zoomAt(event.clientX, event.clientY, nextScale);
}, { passive: false });

viewport.addEventListener("mousedown", event => {
  dragging = true;
  didDrag = false;
  viewport.classList.add("dragging");

  dragStartX = event.clientX;
  dragStartY = event.clientY;
  startX = translateX;
  startY = translateY;
});

window.addEventListener("mousemove", event => {
  if (!dragging) return;

  const deltaX = event.clientX - dragStartX;
  const deltaY = event.clientY - dragStartY;

  if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
    didDrag = true;
  }

  translateX = startX + deltaX;
  translateY = startY + deltaY;

  applyTransform();
});

window.addEventListener("mouseup", () => {
  dragging = false;
  viewport.classList.remove("dragging");
});

viewport.addEventListener("click", event => {
  if (didDrag) return;

  if (pickMode) {
    const coords = getMapCoordinates(event);
    copyMarkerCode(coords.x, coords.y);
    return;
  }

  clearSelection();
});

zoomInButton.addEventListener("click", () => {
  const rect = viewport.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scale * 1.2);
});

zoomOutButton.addEventListener("click", () => {
  const rect = viewport.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scale / 1.2);
});

resetMapButton.addEventListener("click", () => {
  resetMap();
});

pickPointButton.addEventListener("click", () => {
  setPickMode(!pickMode);
});

window.addEventListener("resize", () => {
  resetMap();
});

renderZones();
resetMap();