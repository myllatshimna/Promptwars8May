import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Reoptimizer } from '../engine/Reoptimizer';
import { TripPlanner } from '../engine/TripPlanner';
import { WebSocketManager } from './WebSocketManager';
import { Trip, OptimizationEvent } from '../types/Trip';
import { saveTripToFirestore } from './Firebase';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 1. HTTP Header Security
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for local dev with inline scripts/styles
}));

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// 2. API Rate Limiting (Prevent DDoS/Billing Exhaustion)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per window
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

const reoptimizer = new Reoptimizer();
const tripPlanner = new TripPlanner();
const wsManager = new WebSocketManager();

// In-memory mock trip
let mockTrip: Trip = {
  tripId: 'trip_1',
  userId: 'user_1',
  status: 'ACTIVE',
  constraints: {
    budgetMax: 200,
    currency: 'USD',
    vibes: ['museum', 'local_food', 'sightseeing'],
    mobilityRequirements: []
  },
  schedule: {
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString()
  },
  currentLocation: { lat: 48.8566, lng: 2.3522, lastUpdated: new Date().toISOString() },
  itinerary: [
    {
      segmentId: 'seg_1',
      type: 'EXPERIENCE',
      status: 'UPCOMING',
      name: 'Louvre Museum',
      placeId: 'louvre_123',
      cost: 20,
      startTime: new Date(Date.now() + 3600000).toISOString(),
      endTime: new Date(Date.now() + 10800000).toISOString()
    },
    {
      segmentId: 'seg_2',
      type: 'EXPERIENCE',
      status: 'UPCOMING',
      name: 'Eiffel Tower',
      placeId: 'eiffel_123',
      cost: 30,
      startTime: new Date(Date.now() + 14400000).toISOString(),
      endTime: new Date(Date.now() + 18000000).toISOString()
    }
  ]
};

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  // For demonstration, we assume all connections belong to 'user_1'
  wsManager.connect('user_1', ws as any);

  // Send the initial trip state on connection
  ws.send(JSON.stringify({
    type: 'TRIP_UPDATED',
    timestamp: new Date().toISOString(),
    data: mockTrip
  }));
});

// API endpoint to trigger a real-time event
app.post('/api/trigger-event', async (req, res) => {
  const event: OptimizationEvent = req.body;
  
  console.log(`\n--- Received Event: ${event.type} ---`);
  
  try {
    // Run the engine
    const optimizedTrip = await reoptimizer.handleEvent(mockTrip, event);
    
    // Update our in-memory state
    mockTrip = optimizedTrip;
    
    // Save to Google Cloud Firestore (if configured)
    await saveTripToFirestore(mockTrip);
    
    // Push the updated trip to connected clients
    wsManager.pushTripUpdate('user_1', mockTrip);
    
    res.json({ success: true, message: 'Trip re-optimized and broadcasted successfully.' });
  } catch (error) {
    console.error('Error during re-optimization:', error);
    res.status(500).json({ success: false, error: 'Failed to re-optimize trip' });
  }
});

// 3. Sensitive Data Path Validation Schema
const TripRequestSchema = z.object({
  destination: z.string().min(2).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  budget: z.number().positive().max(100000),
  purpose: z.string().max(50),
  isSolo: z.boolean(),
});

// API endpoint to generate a new trip
app.post('/api/plan-trip', async (req, res) => {
  // Validate Request Body Payload
  const validationResult = TripRequestSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid Request Payload', 
      details: validationResult.error.issues 
    });
  }

  const { destination, startDate, endDate, budget, purpose, isSolo } = validationResult.data;
  
  console.log(`\n--- Received Request to Plan Trip to ${destination} for ${purpose} (Solo: ${isSolo}) ---`);
  
  try {
    // Generate new trip
    mockTrip = await tripPlanner.generateTrip(destination, startDate, endDate, budget, purpose, isSolo);
    
    // Save to Google Cloud Firestore (if configured)
    await saveTripToFirestore(mockTrip);
    
    // Push the new trip to connected clients
    wsManager.pushTripUpdate('user_1', mockTrip);
    
    res.json({ success: true, message: 'New trip generated and broadcasted successfully.' });
  } catch (error: any) {
    if (error.message === 'SECURITY_THREAT_DETECTED') {
      return res.status(403).json({ success: false, error: 'Malicious payload or prompt injection detected. Request blocked by Gemini Security Firewall.' });
    }
    console.error('Error during trip generation:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip' });
  }
});

// API endpoint to serve config (like API Keys) to frontend
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Static files served from: ${path.join(__dirname, '../../public')}`);
});
