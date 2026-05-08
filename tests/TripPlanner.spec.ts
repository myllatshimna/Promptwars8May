import { TripPlanner } from '../src/engine/TripPlanner';

// Mock the GoogleGenAI module to avoid real API calls during tests
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify([
              {
                segmentId: 'mock_ai_1',
                type: 'LODGING',
                status: 'UPCOMING',
                name: 'AI Generated Mock Hotel',
                cost: 500,
                startTime: '2026-05-10T15:00:00.000Z',
                endTime: '2026-05-12T11:00:00.000Z'
              }
            ])
          })
        }
      };
    })
  };
});

describe('TripPlanner Engine', () => {
  let planner: TripPlanner;

  beforeEach(() => {
    planner = new TripPlanner();
    // Temporarily set the env var so the engine attempts to use Gemini
    process.env.GEMINI_API_KEY = 'test_mock_key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    jest.clearAllMocks();
  });

  it('should successfully generate a trip utilizing the Gemini Mock', async () => {
    const trip = await planner.generateTrip('Paris', '2026-05-10T10:00:00Z', '2026-05-15T18:00:00Z', 2000, 'Culture', false);
    
    expect(trip).toBeDefined();
    expect(trip.userId).toBe('user_1');
    expect(trip.constraints.budgetMax).toBe(2000);
    expect(trip.constraints.vibes).toContain('culture');
    
    // Verify that our mock AI segment was injected
    expect(trip.itinerary[0].name).toBe('AI Generated Mock Hotel');
    expect(trip.itinerary[0].cost).toBe(500);
  });

  it('should inject Solo Traveller Safety Briefings when isSolo is true', async () => {
    const trip = await planner.generateTrip('London', '2026-05-10T10:00:00Z', '2026-05-15T18:00:00Z', 1000, 'Adventure', true);
    
    expect(trip.constraints.vibes).toContain('solo-safe');
    
    // Check if the safety briefing was injected
    const hasBriefing = trip.itinerary.some(seg => seg.name?.includes('Safety Briefing'));
    expect(hasBriefing).toBe(true);

    // Check if the last segment has Verified Safe Transit
    const lastSegment = trip.itinerary[trip.itinerary.length - 1];
    expect(lastSegment?.name).toContain('(Verified Safe Transit)');
  });
});
