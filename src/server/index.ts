import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketManager } from './WebSocketManager';
import { Trip } from '../types/Trip';
import tripRoutes from './routes/tripRoutes';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 1. HTTP Header Security
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for local dev with inline scripts/styles
  }),
);

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

const wsManager = new WebSocketManager();
app.locals.wsManager = wsManager;

// In-memory mock trip
let mockTrip: Trip = {
  tripId: 'trip_1',
  userId: 'user_1',
  status: 'ACTIVE',
  constraints: {
    budgetMax: 200,
    currency: 'USD',
    vibes: ['museum', 'local_food', 'sightseeing'],
    mobilityRequirements: [],
  },
  schedule: {
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 86400000).toISOString(),
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
      endTime: new Date(Date.now() + 10800000).toISOString(),
    },
    {
      segmentId: 'seg_2',
      type: 'EXPERIENCE',
      status: 'UPCOMING',
      name: 'Eiffel Tower',
      placeId: 'eiffel_123',
      cost: 30,
      startTime: new Date(Date.now() + 14400000).toISOString(),
      endTime: new Date(Date.now() + 18000000).toISOString(),
    },
  ],
};

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');

  // For demonstration, we assume all connections belong to 'user_1'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wsManager.connect('user_1', ws as any);

  // Send the initial trip state on connection
  ws.send(
    JSON.stringify({
      type: 'TRIP_UPDATED',
      timestamp: new Date().toISOString(),
      data: app.locals.mockTrip,
    }),
  );
});

app.locals.mockTrip = mockTrip;

// 3. Modular API Routes
app.use('/api', tripRoutes);

// API endpoint to serve config (like API Keys) to frontend
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Static files served from: ${path.join(__dirname, '../../public')}`);
});
