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
let vehicleTimestamps = {};


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

    updateMarkers(data.data);
  } catch (err) {
    console.error("Error fetching vehicles:", err);
  }
}

// Make the popup when the bus is clicked on
function generatePopupHTML(v) {
    const age = Math.floor((Date.now() / 1000) - vehicleTimestamps[v.id]);

    return `
        <b>${v.label}</b><br>
        Route: ${v.trip.route_id}<br>
        Trip ID: ${v.trip.trip_id}<br>
        Last update: <span class="age-${v.id}">${age}</span> seconds ago
    `;
}

// Update markers on the map
function updateMarkers(vehicles) {
    vehicles.forEach(v => {
        // Use stable ID (trip-based)
        const id = v.trip?.trip_id || v.id;

        const lat = v.position.latitude;
        const lng = v.position.longitude;

        const newPos = L.latLng(lat, lng);

        // Save the vehicle's update timestamp (seconds)
        vehicleTimestamps[id] = v.timestamp;

        // If marker exists, animate unless jump is huge
        if (markers[id]) {
            const oldPos = markers[id].getLatLng();
            const distance = oldPos.distanceTo(newPos); // meters
            if (distance < 800) {
                // smooth animation
                animateMarker(markers[id], oldPos, newPos, 1500);
                markers[id].bindPopup(generatePopupHTML(v));
            } else {
                // large jump, snap to new location
                markers[id].setLatLng(newPos);
                markers[id].bindPopup(generatePopupHTML(v));
            }
        }
        // If marker doesn't exist, create it
        else {
            const marker = L.marker(newPos, { icon: busIcon });
            marker.bindPopup(generatePopupHTML(v));  
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
setInterval(() => { // update timer in the marker
    const now = Date.now() / 1000;

    for (const id in vehicleTimestamps) {
        const age = Math.floor(now - vehicleTimestamps[id]);
        const el = document.querySelector(`.age-${id}`);
        if (el) el.textContent = age;
    }
}, 1000);
