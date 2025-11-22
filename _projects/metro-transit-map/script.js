// Vehicle positions
// const VEHICLE_POSITIONS_URL = "http://localhost:5000/vehicles";
const VEHICLE_POSITIONS_URL = "https://metro-transit-map-backend.onrender.com/vehicles"

// STL map center
const map = L.map('map').setView([38.6270, -90.1994], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
maxZoom: 19,
}).addTo(map);

// Store markers by vehicle ID
let markers = {};

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

    updateMarkers(data.data);
  } catch (err) {
    console.error("Error fetching vehicles:", err);
  }
}

// Update markers on the map
function updateMarkers(vehicles) {
    vehicles.forEach(v => {
        const id = v.id;
        const lat = v.position.latitude;
        const lng = v.position.longitude;

        const newPos = L.latLng(lat, lng);

        // If marker already exists, animate it
        if (markers[id]) {
            const oldPos = markers[id].getLatLng();
            animateMarker(markers[id], oldPos, newPos);
        } 
        else {
            // Create new marker if it doesn't exist
            const marker = L.marker([lat, lng], { icon: busIcon });
            marker.addTo(map);
            markers[id] = marker;
        }
    });
}


fetchVehicles();    // load immediately
setInterval(fetchVehicles, 5000);   // refresh every 15 seconds
