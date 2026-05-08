import { TripPlanner } from '../src/engine/TripPlanner';

// Create a mock generation function
const mockGenerateContent = jest.fn();

// Mock the GoogleGenAI module globally
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: mockGenerateContent,
        },
      };
    }),
  };
});

// Mock GooglePlacesService
jest.mock('../src/services/GooglePlacesService', () => {
  return {
    GooglePlacesService: jest.fn().mockImplementation(() => {
      return {
        searchTopPlaces: jest.fn().mockResolvedValue([
          {
            id: 'mock_place_1',
            displayName: { text: 'Mock Louvre' },
            formattedAddress: 'Paris, France',
            rating: 4.9,
          },
        ]),
      };
    }),
  };
});

describe('TripPlanner Engine', () => {
  let planner: TripPlanner;

  beforeEach(() => {
    planner = new TripPlanner();
    process.env.GEMINI_API_KEY = 'test_mock_key';

    // Default success behavior
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        itinerary: [
          {
            segmentId: 'mock_ai_1',
            type: 'LODGING',
            status: 'UPCOMING',
            name: 'AI Generated Mock Hotel',
            cost: 500,
            startTime: '2026-05-10T15:00:00.000Z',
            endTime: '2026-05-12T11:00:00.000Z',
          },
        ],
        packingList: ['Sunscreen', 'Walking Shoes'],
        carbonFootprintEstimate: 350,
      }),
    });
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    jest.clearAllMocks();
  });

  it('should successfully generate a trip utilizing the Gemini Mock', async () => {
    const trip = await planner.generateTrip(
      'Paris',
      '2026-05-10T10:00:00Z',
      '2026-05-15T18:00:00Z',
      2000,
      'Culture',
      false,
    );

    expect(trip).toBeDefined();
    expect(trip.userId).toBe('user_1');
    expect(trip.constraints.budgetMax).toBe(2000);
    expect(trip.itinerary[0].name).toBe('AI Generated Mock Hotel');
    expect(trip.packingList).toContain('Sunscreen');
    expect(trip.carbonFootprintEstimate).toBe(350);
  });

  it('should inject Solo Traveller Safety Briefings when isSolo is true', async () => {
    const trip = await planner.generateTrip(
      'London',
      '2026-05-10T10:00:00Z',
      '2026-05-15T18:00:00Z',
      1000,
      'Adventure',
      true,
    );

    expect(trip.constraints.vibes).toContain('solo-safe');
    const hasBriefing = trip.itinerary.some((seg) => seg.name?.includes('Safety Briefing'));
    expect(hasBriefing).toBe(true);
  });

  it('should gracefully fallback to heuristic mock segments if Gemini throws an error', async () => {
    // Force the mock to throw an error
    mockGenerateContent.mockRejectedValue(new Error('GEMINI_API_ERROR'));

    // Run the engine
    const trip = await planner.generateTrip(
      'Rome',
      '2026-05-10T10:00:00Z',
      '2026-05-15T18:00:00Z',
      1000,
      'Culture',
      false,
    );

    // The engine should catch the error and fallback to exactly 4 heuristic segments
    expect(trip.itinerary).toHaveLength(4);
    expect(trip.itinerary[0].name).toContain('Flight to Rome');
  });
});
