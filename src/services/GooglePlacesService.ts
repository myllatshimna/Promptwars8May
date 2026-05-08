import axios, { AxiosInstance } from 'axios';
import { GoogleMapsAPIError } from './GoogleMapsErrorHandler';

export interface PlaceResult {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  rating?: number;
  userRatingCount?: number;
}

export class GooglePlacesService {
  private client: AxiosInstance;
  private readonly API_KEY: string;

  constructor() {
    this.API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

    this.client = axios.create({
      baseURL: 'https://places.googleapis.com',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
      },
    });
  }

  /**
   * Fetches top highly-rated places in a specific destination matching a purpose/vibe.
   */
  public async searchTopPlaces(destination: string, purpose: string): Promise<PlaceResult[]> {
    if (!this.API_KEY) {
      console.warn('[GooglePlacesService] No GOOGLE_MAPS_API_KEY found, bypassing real Places API fetch.');
      return [];
    }

    console.log(`[GooglePlacesService] Fetching real places in ${destination} for purpose: ${purpose}...`);

    try {
      const requestBody = {
        textQuery: `${purpose} in ${destination}`,
        languageCode: 'en',
        maxResultCount: 5,
        minRating: 4.0, // Only fetch highly-rated places for premium experience
      };

      const response = await this.client.post('/v1/places:searchText', requestBody);

      const places: PlaceResult[] = response.data.places || [];
      console.log(`[GooglePlacesService] Successfully fetched ${places.length} real places from Google Maps.`);

      return places;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('[GooglePlacesService] API Error:', error.response.data);
      } else {
        console.error('[GooglePlacesService] Request Error:', error);
      }
      return []; // Gracefully fail and return empty array if API fails, preventing engine crash
    }
  }
}
