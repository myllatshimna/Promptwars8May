const ws = new WebSocket(`ws://${window.location.host}`);

// DOM Elements
const wsStatus = document.getElementById('ws-status');
const budgetValue = document.getElementById('budget-value');
const vibesValue = document.getElementById('vibes-value');
const itineraryContainer = document.getElementById('itinerary-container');
const logsContainer = document.getElementById('logs-container');

const btnClosure = document.getElementById('btn-closure');
const btnDelay = document.getElementById('btn-delay');

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
    const card = document.createElement('div');
    card.className = 'segment-card';
    
    card.innerHTML = `
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
    `;
    
    itineraryContainer.appendChild(card);
  });

  // Scroll the itinerary into view for better UX
  document.querySelector('.trip-state').scrollIntoView({ behavior: 'smooth' });
}

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

// Form Submission for New Trip
tripForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const destination = document.getElementById('destination').value;
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  const budget = parseFloat(document.getElementById('budget').value);
  
  addLog(`Generating new trip to ${destination}...`, 'event');
  btnGenerate.disabled = true;
  btnGenerate.textContent = 'Calculating...';
  
  try {
    const response = await fetch('/api/plan-trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, startDate, endDate, budget })
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
