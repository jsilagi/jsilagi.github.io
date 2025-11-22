// --------------------------------------
// CONFIG — INSERT YOUR REAL FEED URLS
// --------------------------------------
const VEHICLE_POSITIONS_URL = "http://localhost:5000/vehicles";

// STL map center
const map = L.map('map').setView([38.6270, -90.1994], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
maxZoom: 19,
}).addTo(map);

// Store markers by vehicle ID
let markers = {};

// Fetch vehicles from Flask backend
async function fetchVehicles() {
  try {
    const response = await fetch(VEHICLE_POSITIONS_URL);
    const data = await response.json();

    updateMarkers(data.data);
  } catch (err) {
    console.error("Error fetching vehicles:", err);
  }
}

// Update markers on the map
function updateMarkers(vehicles) {
  // clear old markers
  for (const id in markers) {
    map.removeLayer(markers[id]);
  }
  markers = {};

  // add updated markers
  vehicles.forEach(v => {
    if (!v.position) return;

    const lat = v.position.latitude;
    const lon = v.position.longitude;

    // add marker
    const marker = L.marker([lat, lon]).addTo(map);
    marker.bindPopup(`
      Route: ${v.trip?.route_id || "?"}<br>
      Vehicle: ${v.id}
    `);

    markers[v.id] = marker;
    });
}


fetchVehicles();    // load immediately
setInterval(fetchVehicles, 15000);   // refresh every 15 seconds
