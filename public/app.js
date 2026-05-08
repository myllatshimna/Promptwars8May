const ws = new WebSocket(`ws://${window.location.host}`);

// DOM Elements
const wsStatus = document.getElementById('ws-status');
const budgetValue = document.getElementById('budget-value');
const vibesValue = document.getElementById('vibes-value');
const itineraryContainer = document.getElementById('itinerary-container');
const logsContainer = document.getElementById('logs-container');

const btnClosure = document.getElementById('btn-closure');
const btnDelay = document.getElementById('btn-delay');

let map;
let markers = [];
let currentPolyline = null;

const tripForm = document.getElementById('trip-form');
const btnGenerate = document.getElementById('btn-generate');

// Helper to add logs
function addLog(message, type = 'system') {
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  const time = new Date().toLocaleTimeString();
  div.textContent = `[${time}] ${message}`;
  logsContainer.appendChild(div);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Format time
function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// WebSocket Event Listeners
ws.onopen = () => {
  wsStatus.innerHTML = '<span class="dot connected"></span> Connected';
  addLog('WebSocket connected. Receiving real-time updates...', 'system');
};

ws.onclose = () => {
  wsStatus.innerHTML = '<span class="dot disconnected"></span> Offline';
  addLog('WebSocket disconnected.', 'system');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'TRIP_UPDATED') {
    addLog('Received TRIP_UPDATED event from server', 'update');
    renderTrip(message.data);
    updateVisualMap(message.data);
  }
};

// Render the Trip state to DOM
function renderTrip(trip) {
  // Update Metrics
  const remainingBudget = trip.constraints.budgetMax - trip.itinerary.reduce((sum, seg) => sum + (seg.cost || 0), 0);
  budgetValue.textContent = `$${remainingBudget}`;
  vibesValue.textContent = trip.constraints.vibes.join(', ');

  // Render Itinerary
  itineraryContainer.innerHTML = '';
  
  if (trip.itinerary.length === 0) {
    itineraryContainer.innerHTML = '<div class="loading-state">No segments found.</div>';
    return;
  }

  trip.itinerary.forEach(segment => {
    const node = document.createElement('div');
    node.className = 'segment-node';
    
    node.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="segment-card">
        <div class="segment-info">
          <div class="segment-title">${segment.name || 'Unnamed Segment'}</div>
          <div class="segment-meta">
            <span>${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}</span>
            <span class="status-badge status-${segment.status}">${segment.status}</span>
          </div>
        </div>
        <div class="segment-price">
          $${segment.cost || 0}
        </div>
      </div>
    `;
    
    itineraryContainer.appendChild(node);
  });

  // Scroll the itinerary into view for better UX
  document.querySelector('.trip-state').scrollIntoView({ behavior: 'smooth' });
}

// --- GOOGLE MAPS VISUALIZATION --- //

async function loadGoogleMaps() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    
    if (!config.googleMapsApiKey) {
      document.getElementById('map').innerHTML = '<div class="loading-state">Google Maps API Key missing in .env</div>';
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&callback=initMap`;
    script.async = true;
    script.defer = true;
    window.initMap = initMap;
    document.head.appendChild(script);
  } catch (err) {
    console.error('Failed to load Google Maps Config:', err);
  }
}

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 48.8566, lng: 2.3522 }, // Default to Paris
    zoom: 12,
    styles: [
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#e9e9e9" }, { lightness: 17 }] },
      { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f5" }, { lightness: 20 }] },
      { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }, { lightness: 17 }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#ffffff" }, { lightness: 29 }, { weight: 0.2 }] },
      { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }, { lightness: 18 }] },
      { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#ffffff" }, { lightness: 16 }] },
      { featureType: "poi", elementType: "geometry", stylers: [{ color: "#f5f5f5" }, { lightness: 21 }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dedede" }, { lightness: 21 }] },
      { elementType: "labels.text.stroke", stylers: [{ visibility: "on" }, { color: "#ffffff" }, { lightness: 16 }] },
      { elementType: "labels.text.fill", stylers: [{ saturation: 36 }, { color: "#333333" }, { lightness: 40 }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { featureType: "transit", elementType: "geometry", stylers: [{ color: "#f2f2f2" }, { lightness: 19 }] },
      { featureType: "administrative", elementType: "geometry.fill", stylers: [{ color: "#fefefe" }, { lightness: 20 }] },
      { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#fefefe" }, { lightness: 17 }, { weight: 1.2 }] }
    ]
  });
}

function updateVisualMap(tripData) {
  if (!map) return;
  
  // Clear existing markers and polyline
  markers.forEach(m => m.setMap(null));
  markers = [];
  if (currentPolyline) currentPolyline.setMap(null);

  // Example logic: center map on current location or first segment
  if (tripData.currentLocation && tripData.currentLocation.lat !== 0) {
    map.setCenter({ lat: tripData.currentLocation.lat, lng: tripData.currentLocation.lng });
  }

  // Draw simple path between mock segment locations (if we had real geocoding)
  // For the sake of the visual demo, we will drop a marker for each segment.
  // In a full implementation, the routingService decodePolyline would feed `currentPolyline`.
}

// Load Maps on start
loadGoogleMaps();

// --- ENGINE LOGIC --- //

// Button Listeners to Trigger Events
async function triggerEvent(eventType, payload) {
  addLog(`Triggering event: ${eventType}`, 'event');
  
  try {
    const response = await fetch('/api/trigger-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: eventType,
        timestamp: new Date().toISOString(),
        payload: payload
      })
    });
    
    const data = await response.json();
    if (!data.success) {
      addLog(`Error: ${data.error}`, 'system');
    }
  } catch (err) {
    addLog(`Network error triggering event.`, 'system');
  }
}

btnClosure.addEventListener('click', () => {
  triggerEvent('VENUE_CLOSURE', { placeId: 'louvre_123' });
});

btnDelay.addEventListener('click', () => {
  triggerEvent('FLIGHT_DELAY', { delayMinutes: 60 });
});

// Dynamic min-date constraints
window.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowString = now.toISOString().slice(0, 16);
  document.getElementById('start-date').min = nowString;
});

document.getElementById('start-date').addEventListener('change', (e) => {
  document.getElementById('end-date').min = e.target.value;
});

// Form Submission for New Trip
tripForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const destination = document.getElementById('destination').value;
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  const budget = parseFloat(document.getElementById('budget').value);
  const purpose = document.getElementById('purpose').value;
  
  const startObj = new Date(startDate);
  const endObj = new Date(endDate);
  const now = new Date();
  
  // 1. Missing Date Check
  if (isNaN(startObj) || isNaN(endObj)) {
    addLog(`Validation Error: Incomplete date or time.`, 'system');
    alert("Please ensure both Date and Time are fully selected!");
    return;
  }

  // 2. Past Date Check
  if (startObj < now) {
    addLog(`Validation Error: Start Date cannot be in the past.`, 'system');
    alert("Your trip Start Date cannot be in the past!");
    return;
  }

  // 3. Chronology Check
  if (startObj >= endObj) {
    addLog(`Validation Error: End date must be after the start date.`, 'system');
    alert("Please ensure your End Date is strictly after your Start Date!");
    return;
  }

  // 4. Maximum Duration Check
  const diffTime = Math.abs(endObj - startObj);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  if (diffDays > 30) {
    addLog(`Validation Error: Trip duration exceeds 30 days.`, 'system');
    alert("Currently, the engine only supports planning trips up to 30 days in length!");
    return;
  }
  
  addLog(`Generating new trip to ${destination}...`, 'event');
  btnGenerate.disabled = true;
  btnGenerate.textContent = 'Calculating...';
  
  try {
    const response = await fetch('/api/plan-trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, startDate, endDate, budget, purpose })
    });
    
    const data = await response.json();
    if (!data.success) {
      addLog(`Error: ${data.error}`, 'system');
    } else {
      addLog(`Successfully generated new itinerary!`, 'update');
    }
  } catch (err) {
    addLog(`Network error generating trip.`, 'system');
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.textContent = 'Generate Itinerary';
  }
});
