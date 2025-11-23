// Vehicle positions
// const VEHICLE_POSITIONS_URL = "http://localhost:5000/vehicles";
const VEHICLE_POSITIONS_URL = "https://metro-transit-map-backend.onrender.com/vehicles"

// STL map center
const map = L.map('map').setView([38.6270, -90.1994], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
maxZoom: 19,
}).addTo(map);

const busIcon = L.icon({
    iconUrl: "bus.png",   // Bus icons created by Pixel perfect - Flaticon (https://www.flaticon.com/free-icons/bus)
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Store markers by vehicle ID
let markers = {};
// Keep track of how often vehicle locations are updated
let lastFetchTime = null;


function updateLastUpdatedLabel() {
    if (!lastFetchTime) return;

    const now = Date.now();
    const diffSec = Math.floor((now - lastFetchTime) / 1000);

    const label = document.getElementById("last-updated");
    label.textContent = `Last updated: ${diffSec} seconds ago`;
}

// Animation function
function animateMarker(marker, fromLatLng, toLatLng, duration = 1500) {
    const start = performance.now();

    function frame(time) {
        const progress = Math.min((time - start) / duration, 1);

        const lat = fromLatLng.lat + (toLatLng.lat - fromLatLng.lat) * progress;
        const lng = fromLatLng.lng + (toLatLng.lng - fromLatLng.lng) * progress;

        marker.setLatLng([lat, lng]);

        if (progress < 1) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
}

// Fetch vehicles from Flask backend
async function fetchVehicles() {
  try {
    const response = await fetch(VEHICLE_POSITIONS_URL);
    const data = await response.json();

    lastFetchTime = Date.now();
    updateLastUpdatedLabel();

    updateMarkers(data.data);
  } catch (err) {
    console.error("Error fetching vehicles:", err);
  }
}

// Update markers on the map
function updateMarkers(vehicles) {
    vehicles.forEach(v => {
        // Use stable ID (trip-based)
        const id = v.trip?.trip_id || v.id;

        const lat = v.position.latitude;
        const lng = v.position.longitude;

        const newPos = L.latLng(lat, lng);

        // If marker exists, animate unless jump is huge
        if (markers[id]) {
            const oldPos = markers[id].getLatLng();
            const distance = oldPos.distanceTo(newPos); // meters

            if (distance < 800) {
                // smooth animation
                animateMarker(markers[id], oldPos, newPos, 1500);
            } else {
                // large jump, snap to new location
                markers[id].setLatLng(newPos);
            }
        }
        else {
            // Create new marker
            const marker = L.marker(newPos, { icon: busIcon });
            marker.bindPopup(`
                <b>${v.label}</b><br>
                Route: ${v.trip.route_id}<br>
                Trip ID: ${v.trip.trip_id}<br>
                Last update: ${Math.floor((Date.now() / 1000) - v.timestamp)} seconds ago
            `);
            marker.addTo(map);
            markers[id] = marker;
        }
    });

    // Remove markers that are no longer in the feed
    Object.keys(markers).forEach(id => {
        const stillExists = vehicles.some(
            v => (v.trip?.trip_id || v.id) === id
        );

        if (!stillExists) {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    });
}


fetchVehicles();    // load immediately
setInterval(fetchVehicles, 5000);   // refresh vehicles every 5 seconds
setInterval(updateLastUpdatedLabel, 1000); // refresh last updated every 1 second
