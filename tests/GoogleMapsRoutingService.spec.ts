import { GoogleMapsRoutingService } from '../src/services/GoogleMapsRoutingService';
import { ComputeRoutesRequest } from '../src/types/GoogleMaps';

const mockPost = jest.fn();

jest.mock('axios', () => {
  return {
    create: jest.fn(() => ({
      post: mockPost,
    })),
  };
});
import axios from 'axios';

describe('GoogleMapsRoutingService API Mocks', () => {
  let routingService: GoogleMapsRoutingService;

  beforeEach(() => {
    routingService = new GoogleMapsRoutingService();
    // Default mock behavior for successful API call
    mockPost.mockResolvedValue({
      data: {
        routes: [
          {
            distanceMeters: 5000,
            duration: '1200s',
            polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
          },
        ],
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should compute routes by fetching from mocked API (no real network call)', async () => {
    const request: ComputeRoutesRequest = {
      origin: { location: { latLng: { latitude: 37.419734, longitude: -122.0827784 } } },
      destination: { location: { latLng: { latitude: 37.41767, longitude: -122.079595 } } },
      travelMode: 'DRIVE',
    };

    // Passing 'false' to explicitly force it to use the mocked Axios call instead of the hardcoded mock path
    const routeResponse = await routingService.computeRoutes(request, false);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(routeResponse).toBeDefined();
    expect(routeResponse?.routes[0].distanceMeters).toBe(5000);
    expect(routeResponse?.routes[0].duration).toBe('1200s');
  });

  it('should cache responses to avoid redundant mock API calls', async () => {
    const request: ComputeRoutesRequest = {
      origin: { location: { latLng: { latitude: 37.419734, longitude: -122.0827784 } } },
      destination: { location: { latLng: { latitude: 37.41767, longitude: -122.079595 } } },
      travelMode: 'BICYCLE',
    };

    // First call uses axios
    await routingService.computeRoutes(request, false);
    expect(mockPost).toHaveBeenCalledTimes(1);

    // Second call hits in-memory cache
    await routingService.computeRoutes(request, false);
    expect(mockPost).toHaveBeenCalledTimes(1); // Still 1!
  });

  it('should decode a Google Maps polyline correctly', () => {
    const mockPolyline = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const decoded = routingService.decodePolyline(mockPolyline);

    expect(decoded.length).toBeGreaterThan(0);
    expect(decoded[0][0]).toBeCloseTo(38.5, 1);
    expect(decoded[0][1]).toBeCloseTo(-120.2, 1);
  });

  it('should handle API errors gracefully', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { error: { message: 'Permission Denied' } },
      },
    });

    const request: ComputeRoutesRequest = {
      origin: { location: { latLng: { latitude: 0, longitude: 0 } } },
      destination: { location: { latLng: { latitude: 1, longitude: 1 } } },
      travelMode: 'DRIVE',
    };

    // It should throw the properly formatted GoogleMapsAPIError
    await expect(routingService.computeRoutes(request, false)).rejects.toThrow('Permission Denied or Quota Exceeded');
  });
});
