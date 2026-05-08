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

    // Default success behavior: security check returns SAFE, main call returns itinerary object
    mockGenerateContent
      .mockResolvedValueOnce({ text: 'SAFE' }) // First call: security firewall
      .mockResolvedValue({                      // Subsequent calls: itinerary generation
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
    // Suppress console output — these errors are INTENTIONAL and expected
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Force ALL generateContent calls (security + itinerary) to throw
    mockGenerateContent.mockRejectedValue(new Error('GEMINI_API_ERROR'));

    const trip = await planner.generateTrip(
      'Rome',
      '2026-05-10T10:00:00Z',
      '2026-05-15T18:00:00Z',
      1000,
      'Culture',
      false,
    );

    // Verify the engine logged the fallback (proves error handling executed correctly)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TripPlanner] Gemini AI failed'),
      expect.any(Error),
    );

    // The engine should catch the error and produce 4 heuristic fallback segments
    expect(trip.itinerary).toHaveLength(4);
    expect(trip.itinerary[0].name).toContain('Flight to Rome');

    // Restore console back to normal
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});
