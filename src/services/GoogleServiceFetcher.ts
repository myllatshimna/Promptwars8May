import { Location } from '../types/Trip';

export class GoogleServiceFetcher {
  private readonly MAPS_API_KEY: string;

  constructor(apiKey: string = process.env.GOOGLE_MAPS_API_KEY || 'MOCK_KEY') {
    this.MAPS_API_KEY = apiKey;
  }

  /**
   * Fetches route information using the Google Routes API.
   * Utilizes Field Masking to only request necessary fields and minimize payload size.
   */
  public async getRoute(origin: Location, destination: Location, mode: string = 'TRANSIT') {
    // Expected field mask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline
    console.log(
      `[GoogleServiceFetcher] Fetching route from (${origin.lat}, ${origin.lng}) to (${destination.lat}, ${destination.lng})`,
    );

    const requestBody = {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: mode,
    };

    // In a real implementation:
    // const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-Goog-Api-Key': this.MAPS_API_KEY,
    //     'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
    //   },
    //   body: JSON.stringify(requestBody)
    // });

    // Mocking response based on field mask
    return {
      routes: [
        {
          duration: '1200s',
          distanceMeters: 4500,
          polyline: {
            encodedPolyline: 'mock_encoded_polyline_data_here',
          },
        },
      ],
    };
  }

  /**
   * Fetches nearby places based on vibe/sentiment.
   * Batch processing simulated here by fetching multiple places.
   * Utilizes Field Masking.
   */
  public async fetchPlacesBatch(location: Location, vibes: string[], maxBudget: number) {
    // Field Mask: places.id,places.displayName,places.priceLevel,places.rating
    console.log(
      `[GoogleServiceFetcher] Fetching batch places near (${location.lat}, ${location.lng}) matching vibes: ${vibes.join(',')}`,
    );

    // Mock response representing places API search results
    return [
      {
        id: 'ChIJ_mock_1',
        displayName: { text: 'Cozy Vibe Cafe', languageCode: 'en' },
        priceLevel: 'PRICE_LEVEL_MODERATE',
        rating: 4.8,
      },
      {
        id: 'ChIJ_mock_2',
        displayName: { text: 'Historical Museum', languageCode: 'en' },
        priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
        rating: 4.5,
      },
    ];
  }
}
