// Vehicle positions
const VEHICLE_POSITIONS_URL = "https://metro-transit-map-backend.onrender.com/vehicles";

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

// Store markers + timestamps
let markers = {};
let vehicleTimestamps = {};


// Animation function
function animateMarker(marker, fromLatLng, toLatLng, duration = 1500) {
    const start = performance.now();

    function frame(time) {
        const progress = Math.min((time - start) / duration, 1);

        const lat = fromLatLng.lat + (toLatLng.lat - fromLatLng.lat) * progress;
        const lng = fromLatLng.lng + (toLatLng.lng - fromLatLng.lng) * progress;

        marker.setLatLng([lat, lng]);

        if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

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


// Popup HTML
function generatePopupHTML(v, id) {
    const ts = vehicleTimestamps[id];        // timestamp in seconds
    const age = Math.floor(Date.now() / 1000 - ts);

    return `
        <b>${v.label}</b><br>
        Route: ${v.trip.route_id}<br>
        Vehicle ID: ${id}<br>
        Last update: 
        <span class="age-${id}">
            ${age}
        </span> seconds ago
    `;
}


// Update markers
function updateMarkers(vehicles) {
    vehicles.forEach(v => {
        // USE ONE CONSISTENT ID ACROSS EVERYTHING
        const id = v.trip?.trip_id || v.id;

        const lat = v.position.latitude;
        const lng = v.position.longitude;
        const newPos = L.latLng(lat, lng);

        // Save timestamp (backend gives seconds)
        vehicleTimestamps[id] = v.timestamp;

        // If marker exists
        if (markers[id]) {
            const oldPos = markers[id].getLatLng();
            const distance = oldPos.distanceTo(newPos);
            // Animate if the jump is not huge
            if (distance < 800) {
                animateMarker(markers[id], oldPos, newPos);
            // Otherwise just place it
            } else {
                markers[id].setLatLng(newPos);
            }

            markers[id].bindPopup(generatePopupHTML(v, id));
        }

        // If marker does not exist
        else {
            const marker = L.marker(newPos, { icon: busIcon });
            marker.bindPopup(generatePopupHTML(v, id));
            marker.addTo(map);
            markers[id] = marker;
        }
    });

    // Remove missing vehicles
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


// Intervals
fetchVehicles();
setInterval(fetchVehicles, 5000); // Fetch every 5 sec

// Update the "Last update X seconds ago" text every 1 sec
setInterval(() => {
    const now = Date.now() / 1000;

    Object.keys(vehicleTimestamps).forEach(id => {
        const el = document.querySelector(`.age-${id}`);
        if (el) {
            const age = Math.floor(now - vehicleTimestamps[id]);
            el.textContent = age;
        }
    });
}, 1000);
