import { Reoptimizer } from '../src/engine/Reoptimizer';
import { Trip, OptimizationEvent } from '../src/types/Trip';

describe('Reoptimizer Engine', () => {
  let reoptimizer: Reoptimizer;
  let mockTrip: Trip;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeAll(() => {
    // Suppress expected console output so CI doesn't treat warnings as failures
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  beforeEach(() => {
    reoptimizer = new Reoptimizer();
    mockTrip = {
      tripId: 'trip_1',
      userId: 'user_1',
      status: 'ACTIVE',
      constraints: {
        budgetMax: 100,
        currency: 'USD',
        vibes: ['museum', 'coffee'],
        mobilityRequirements: [],
      },
      schedule: {
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 86400000).toISOString(),
      },
      currentLocation: { lat: 0, lng: 0, lastUpdated: new Date().toISOString() },
      itinerary: [
        {
          segmentId: 'seg_1',
          type: 'EXPERIENCE',
          status: 'COMPLETED',
          cost: 20,
          name: 'First Experience',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          segmentId: 'seg_2',
          type: 'EXPERIENCE',
          status: 'UPCOMING',
          name: 'Closed Venue',
          placeId: 'closed_venue_123',
          cost: 50,
          startTime: new Date(Date.now() + 1800000).toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
        },
      ],
    };
  });

  it('should drop closed venues and replace them within budget constraints', async () => {
    const event: OptimizationEvent = {
      type: 'VENUE_CLOSURE',
      payload: { placeId: 'closed_venue_123' },
      timestamp: new Date().toISOString(),
    };

    const updatedTrip = await reoptimizer.handleEvent(mockTrip, event);

    // Initial budget = 100
    // Spent = 20 (seg_1)
    // Remaining before replacement = 80
    // Reoptimizer mocks a replacement cost capped at min(budget, 25) -> 25

    // Expect itinerary to NOT contain seg_2
    const hasSeg2 = updatedTrip.itinerary.some((s) => s.segmentId === 'seg_2');
    expect(hasSeg2).toBe(false);

    // Expect 2 segments total (1 completed, 1 new replacement)
    expect(updatedTrip.itinerary).toHaveLength(2);

    const newSegment = updatedTrip.itinerary.find((s) => s.segmentId.startsWith('seg_new_'));
    expect(newSegment?.cost).toBe(25);
  });

  it('should return original trip if event impacts no segments', async () => {
    const event: OptimizationEvent = {
      type: 'VENUE_CLOSURE',
      payload: { placeId: 'non_existent_venue' },
      timestamp: new Date().toISOString(),
    };

    const updatedTrip = await reoptimizer.handleEvent(mockTrip, event);

    expect(updatedTrip.itinerary).toHaveLength(2);
    expect(updatedTrip.itinerary[1].segmentId).toBe('seg_2');
  });
});
