// Vehicle positions
const BUS_URL = "https://metro-transit-map-backend.onrender.com/vehicles";
const TRAIN_URL = "https://metro-transit-map-backend.onrender.com/scheduled_trains"

// Initialize map
const map = L.map('map').setView([38.6270, -90.1994], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19,}).addTo(map);

const busIcon = L.icon({
    iconUrl: "bus.png",   // Bus icons created by Pixel perfect - Flaticon (https://www.flaticon.com/free-icons/bus)
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});
const trainIcon = L.icon({
    iconUrl: "train.png",   // Train icons created by Pixel perfect - Flaticon (https://www.flaticon.com/free-icons/train)
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
});

// Store markers + timestamps
let busMarkers = {};
let trainMarkers = {}
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

// Fetch buses from Flask backend
async function fetchBuses() {
    try {
        const response = await fetch(BUS_URL);
        const data = await response.json();
        updateBusMarkers(data.data);
    } catch (err) {
        console.error("Error fetching buses:", err);
    }
}

// Popup HTML
function generateBusPopupHTML(v, id) {
    const ts = vehicleTimestamps[id];
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
function updateBusMarkers(vehicles) {
    vehicles.forEach(v => {
        // USE ONE CONSISTENT ID ACROSS EVERYTHING
        const id = v.trip?.trip_id || v.id;

        const lat = v.position.latitude;
        const lng = v.position.longitude;
        const newPos = L.latLng(lat, lng);

        // Save timestamp
        vehicleTimestamps[id] = v.timestamp;

        // If marker exists
        if (busMarkers[id]) {
            const oldPos = busMarkers[id].getLatLng();
            const distance = oldPos.distanceTo(newPos);
            // Animate if the jump is not huge
            if (distance < 800) {
                animateMarker(busMarkers[id], oldPos, newPos);
            // Otherwise just place it
            } else {
                busMarkers[id].setLatLng(newPos);
            }
            busMarkers[id].bindPopup(generatePopupHTML(v, id));
        }

        // If marker does not exist
        else {
            const marker = L.marker(newPos, { icon: busIcon });
            marker.bindPopup(generatePopupHTML(v, id));
            marker.addTo(map);
            busMarkers[id] = marker;
        }
    });

    // Remove missing buses
    Object.keys(busMarkers).forEach(id => {
        const stillExists = vehicles.some(
            v => (v.trip?.trip_id || v.id) === id
        );

        if (!stillExists) {
            map.removeLayer(busMarkers[id]);
            delete busMarkers[id];
        }
    });
}


// Trains (scheduled)
async function fetchTrains() {
  try {
    const res = await fetch(TRAIN_URL);
    const j = await res.json();
    const trains = j.data || [];
    updateTrainMarkers(trains);
  } catch (e) {
    console.error("Error fetching trains:", e);
  }
}

// Popup HTML
function generateTrainPopup(t) {
  const id = t.trip_id;
  const ts = t.received_at || Math.floor(Date.now()/1000); // scheduled data, use receipt time for freshness
  const age = Math.floor(Date.now()/1000 - ts);
  const nextStop = t.next_stop_id || "N/A";
  return `<b>MetroLink ${t.route_id === "19251B" ? "Blue" : "Red"} Line</b><br>
          Trip: ${id}<br>
          Next stop: ${nextStop}<br>
          Arrives in: ${t.secs_to_next != null ? t.secs_to_next + "s" : "N/A"}<br>
          Last update: <span class="age-train-${id}">${age}</span> seconds ago`;
}

// Update markers
function updateTrainMarkers(trains) {
  // trains: [{trip_id,route_id,lat,lon,next_stop_id,secs_to_next}]
  const nowReceipt = Math.floor(Date.now()/1000);
  trains.forEach(t => {
    const id = t.trip_id;
    const lat = t.lat;
    const lon = t.lon;
    if (lat == null || lon == null) return;
    const newPos = L.latLng(lat, lon);

    // Attach a receipt timestamp so popup freshness resets when we get new scheduled refresh
    t.received_at = nowReceipt;

    if (trainMarkers[id]) {
      const oldPos = trainMarkers[id].getLatLng();
      const d = oldPos.distanceTo(newPos);
      if (d < 2000) {
        animateMarker(trainMarkers[id], oldPos, newPos, 2000);
      } else {
        trainMarkers[id].setLatLng(newPos);
      }
      trainMarkers[id].bindPopup(generateTrainPopup(t));
    } else {
      const m = L.marker(newPos, { icon: trainIcon });
      m.bindPopup(generateTrainPopup(t));
      m.addTo(map);
      trainMarkers[id] = m;
    }

    // Store timestamp for updating popup counters
    vehicleTimestamps["train-" + id] = nowReceipt;
  });

  // Remove trains no longer present
  const idsNow = new Set(trains.map(t => t.trip_id));
  Object.keys(trainMarkers).forEach(k => {
    if (!idsNow.has(k)) {
      map.removeLayer(trainMarkers[k]);
      delete trainMarkers[k];
      delete vehicleTimestamps["train-" + k];
    }
  });
}


// Intervals
fetchBuses()
fetchTrains();
setInterval(fetchBuses, 5000); // Fetch buses every 5 sec
setInterval(fetchTrains, 15000) // Fetch trains every 15 sec

// Update the "Last update X seconds ago" text every 1 sec (for both buses and trains)
setInterval(() => {
  const now = Math.floor(Date.now()/1000);

  Object.keys(vehicleTimestamps).forEach(k => {
    const className = k.startsWith("train-") ? `.age-train-${k.slice(6)}` : `.age-${k}`;
    const el = document.querySelector(className);
    if (el) {
      const age = Math.floor(now - vehicleTimestamps[k]);
      el.textContent = age;
    }
  });
}, 1000);
