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
const btnReadAloud = document.getElementById('btn-read-aloud');

let currentTripData = null;

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
  document.getElementById('budget-value').textContent = `$${remainingBudget}`;
  
  // Calculate mock CO2 based on transit segments
  const flightSegments = trip.itinerary.filter(s => s.type === 'TRANSIT' && s.name.toLowerCase().includes('flight')).length;
  const mockCo2 = (flightSegments * 450) + (trip.itinerary.length * 15);
  document.getElementById('co2-value').textContent = `${mockCo2} kg`;
  
  // Mock Weather based on vibe/purpose
  const vibe = trip.constraints.vibes[0] || 'culture';
  let weatherText = '☀️ 78°F';
  if (vibe === 'adventure') weatherText = '⛅ 65°F';
  if (vibe === 'luxury') weatherText = '🌴 82°F';
  document.getElementById('weather-value').textContent = weatherText;

  // Render Itinerary
  itineraryContainer.innerHTML = '';
  
  if (trip.itinerary.length === 0) {
    itineraryContainer.innerHTML = '<div class="loading-state">No segments found.</div>';
    return;
  }

  trip.itinerary.forEach((segment, index) => {
    const node = document.createElement('div');
    node.className = 'segment-node';
    
    node.innerHTML = `
      <div class="segment-icon">${getIconForSegment(segment)}</div>
      <div class="segment-card" style="animation-delay: ${index * 0.15}s">
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

  // Reveal the Read Aloud button for accessibility
  if (btnReadAloud) {
    btnReadAloud.style.display = 'inline-flex';
  }

  // Scroll the itinerary into view for better UX
  document.querySelector('.trip-state').scrollIntoView({ behavior: 'smooth' });
}

// Icon Helper
function getIconForSegment(segment) {
  const name = segment.name.toLowerCase();
  if (name.includes('safety') || segment.type === 'SAFETY') {
    // Shield Icon
    return `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  }
  if (name.includes('flight')) {
    return `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" opacity="0"/><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6 4-3 3-3-1-2 2 4.5 1.5L10 22l2-2-1-3 3-3 4 6l1.2-.7c.4-.2.7-.6.6-1.1z"/></svg>`;
  }
  if (name.includes('train') || name.includes('scenic') || segment.type === 'TRANSIT') {
    // Old Transport / Train icon
    return `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="4" y="3" width="16" height="14" rx="2" ry="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="M8 21l-2-4"/><path d="M16 21l2-4"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/></svg>`;
  }
  if (segment.type === 'LODGING') {
    // Bed icon
    return `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`;
  }
  if (name.includes('eat') || name.includes('dining') || name.includes('tasting')) {
    // Dining icon
    return `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`;
  }
  // Generic Experience icon
  return `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`;
}

// --- OPENSOURCE MAPS VISUALIZATION (LEAFLET + OSM) --- //

function initMap() {
  // Initialize Leaflet map, defaulting to Paris
  map = L.map('map').setView([48.8566, 2.3522], 12);

  // Add OpenStreetMap tiles (Free, no API key required)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
}

async function updateVisualMap(tripData) {
  if (!map) return;
  
  // Clear existing markers and polyline
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  if (currentPolyline) map.removeLayer(currentPolyline);

  let destination = "Paris"; // Fallback
  if (document.getElementById('destination')) {
    destination = document.getElementById('destination').value;
  }

  // Use Free Nominatim Geocoder to find destination coordinates
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`);
    const data = await res.json();
    
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      
      // Fly to destination smoothly
      map.flyTo([lat, lon], 12, { duration: 2 });
      
      // Simulate markers for segments
      tripData.itinerary.forEach((segment, index) => {
        // Add some random scatter so pins aren't on top of each other
        const latOffset = (Math.random() - 0.5) * 0.05;
        const lonOffset = (Math.random() - 0.5) * 0.05;
        
        const marker = L.marker([lat + latOffset, lon + lonOffset])
          .bindPopup(`<b>${segment.name}</b><br>$${segment.cost || 0}`)
          .addTo(map);
        markers.push(marker);
      });

      // Draw a polyline connecting the markers to simulate a route
      if (markers.length > 1) {
        const latlngs = markers.map(m => m.getLatLng());
        currentPolyline = L.polyline(latlngs, {color: '#0ea5e9', weight: 4, opacity: 0.7}).addTo(map);
      }
    }
  } catch (err) {
    console.error('Failed to geocode destination with Nominatim:', err);
  }
}

// --- WIKIPEDIA IMAGE GALLERY --- //

async function fetchDestinationImages(destination) {
  const gallery = document.getElementById('image-gallery');
  gallery.innerHTML = '<div class="loading-state">Fetching inspiration from Wikipedia...</div>';
  
  try {
    // Clean up destination string (e.g., "Tokyo, Japan" -> "Tokyo")
    const cleanDest = destination.split(',')[0].trim();
    
    // 1. Get images from the main article
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(cleanDest)}&prop=images&imlimit=20&format=json&origin=*`);
    const data = await res.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    if (pageId === '-1' || !pages[pageId].images) {
      gallery.innerHTML = '<div class="loading-state">No images found for this destination.</div>';
      return;
    }
    
    const images = pages[pageId].images;
    
    // Filter out svgs, flags, maps, icons
    const validImages = images.filter(img => {
      const title = img.title.toLowerCase();
      return !title.includes('.svg') && !title.includes('flag') && !title.includes('map') && !title.includes('icon') && !title.includes('logo');
    });
    
    if (validImages.length === 0) {
      gallery.innerHTML = '<div class="loading-state">No suitable photos found.</div>';
      return;
    }

    gallery.innerHTML = ''; // Clear loading
    
    // Get URLs for top 4 valid images
    let count = 0;
    for (let i = 0; i < validImages.length && count < 4; i++) {
      const imgInfoRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(validImages[i].title)}&prop=imageinfo&iiprop=url&format=json&origin=*`);
      const imgInfoData = await imgInfoRes.json();
      const imgPages = imgInfoData.query.pages;
      const imgPageId = Object.keys(imgPages)[0];
      
      if (imgPages[imgPageId].imageinfo && imgPages[imgPageId].imageinfo[0]) {
        const url = imgPages[imgPageId].imageinfo[0].url;
        
        // Append to gallery
        const img = document.createElement('img');
        img.src = url;
        img.className = 'gallery-image';
        img.alt = `Photo of ${cleanDest}`;
        img.style.animationDelay = `${count * 0.2}s`; // Stagger animation
        gallery.appendChild(img);
        
        count++;
      }
    }
  } catch (err) {
    console.error('Failed to fetch destination images:', err);
    gallery.innerHTML = '<div class="loading-state">Failed to load images.</div>';
  }
}

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
  const isSolo = document.getElementById('solo-traveller').checked;
  
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
      body: JSON.stringify({ destination, startDate, endDate, budget, purpose, isSolo })
    });
    
    const data = await response.json();
    if (!data.success) {
      addLog(`Error: ${data.error}`, 'system');
    } else {
      addLog(`Successfully generated new itinerary!`, 'update');
      currentTripData = data.trip;
      // Fetch inspiration images for the new destination
      fetchDestinationImages(destination);
    }
  } catch (err) {
    addLog(`Network error generating trip.`, 'system');
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.textContent = 'Generate Itinerary';
  }
});

// --- ACCESSIBILITY (a11y) AUDIO ENGINE --- //

btnReadAloud.addEventListener('click', () => {
  if (!currentTripData) return;
  
  // Stop any currently playing audio
  window.speechSynthesis.cancel();
  
  let narrative = `Here is your custom itinerary for ${document.getElementById('destination').value}. `;
  
  if (currentTripData.constraints.vibes.includes('solo-safe')) {
    narrative += `Solo traveller safety protocols have been activated for this trip. `;
  }
  
  narrative += `You have ${currentTripData.itinerary.length} scheduled segments. `;
  
  currentTripData.itinerary.forEach((segment, index) => {
    narrative += `Step ${index + 1}: ${segment.name}. `;
  });
  
  narrative += `We hope you enjoy your trip with Kingdom of Heaven.`;
  
  const utterance = new SpeechSynthesisUtterance(narrative);
  utterance.rate = 0.9; // Slightly slower for better comprehension
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
});
