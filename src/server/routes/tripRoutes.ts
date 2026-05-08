import express, { Request, Response } from 'express';
import { z } from 'zod';
import { Reoptimizer } from '../../engine/Reoptimizer';
import { TripPlanner } from '../../engine/TripPlanner';
import { WebSocketManager } from '../WebSocketManager';
import { saveTripToFirestore } from '../Firebase';
import { Trip, OptimizationEvent } from '../../types/Trip';

const router = express.Router();

const reoptimizer = new Reoptimizer();
const tripPlanner = new TripPlanner();
// In a real production app, WebSocketManager and mockTrip would be managed via a Database/Store singleton
// We will pass them in as dependencies or import the singleton.
// For now, we will assume wsManager and mockTrip are passed via app.locals

// 3. Sensitive Data Path Validation Schema
const TripRequestSchema = z.object({
  destination: z.string().min(2).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  budget: z.number().positive().max(100000),
  purpose: z.string().max(50),
  isSolo: z.boolean(),
});

router.post('/trigger-event', async (req: Request, res: Response) => {
  const event: OptimizationEvent = req.body;
  const wsManager: WebSocketManager = req.app.locals.wsManager;
  let mockTrip: Trip = req.app.locals.mockTrip;

  console.log(`\n--- Received Event: ${event.type} ---`);

  try {
    const optimizedTrip = await reoptimizer.handleEvent(mockTrip, event);
    mockTrip = optimizedTrip;
    req.app.locals.mockTrip = mockTrip;

    await saveTripToFirestore(mockTrip);
    wsManager.pushTripUpdate('user_1', mockTrip);

    res.json({ success: true, message: 'Trip re-optimized and broadcasted successfully.' });
  } catch (error: unknown) {
    console.error('Error during re-optimization:', error);
    res.status(500).json({ success: false, error: 'Failed to re-optimize trip' });
  }
});

router.post('/plan-trip', async (req: Request, res: Response) => {
  const validationResult = TripRequestSchema.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Request Payload',
      details: validationResult.error.issues,
    });
  }

  const { destination, startDate, endDate, budget, purpose, isSolo } = validationResult.data;
  const wsManager: WebSocketManager = req.app.locals.wsManager;

  console.log(`\n--- Received Request to Plan Trip to ${destination} for ${purpose} (Solo: ${isSolo}) ---`);

  try {
    const mockTrip = await tripPlanner.generateTrip(destination, startDate, endDate, budget, purpose, isSolo);
    req.app.locals.mockTrip = mockTrip;

    await saveTripToFirestore(mockTrip);
    wsManager.pushTripUpdate('user_1', mockTrip);

    res.json({ success: true, message: 'New trip generated and broadcasted successfully.' });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'SECURITY_THREAT_DETECTED') {
      return res.status(403).json({
        success: false,
        error: 'Malicious payload or prompt injection detected. Request blocked by Gemini Security Firewall.',
      });
    }
    console.error('Error during trip generation:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip' });
  }
});

export default router;
