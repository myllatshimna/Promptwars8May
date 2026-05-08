import axios, { AxiosInstance } from 'axios';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { 
  ComputeRoutesRequest, 
  ComputeRoutesResponse, 
  ComputeRouteMatrixRequest, 
  RouteMatrixElement 
} from '../types/GoogleMaps';
import { GoogleMapsErrorHandler } from './GoogleMapsErrorHandler';

dotenv.config();

export class GoogleMapsRoutingService {
  private client: AxiosInstance;
  private redis: Redis | null = null;
  private memoryCache: Map<string, { value: string, expiresAt: number }> = new Map();
  private apiKey: string;
  private isMockMode: boolean = false;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('[GoogleMapsRoutingService] No GOOGLE_MAPS_API_KEY found in environment. Running in MOCK mode.');
      this.isMockMode = true;
    }

    this.client = axios.create({
      baseURL: 'https://routes.googleapis.com',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey
      }
    });

    // Setup Redis or fallback to in-memory cache
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
      this.redis.on('error', (err) => {
        console.error('[Redis] Connection error:', err);
        this.redis = null; // fallback to memory on error
      });
    }
  }

  /**
   * Helper to decode Google Maps Encoded Polyline into [lat, lng] arrays
   */
  public decodePolyline(encoded: string): [number, number][] {
    let points: [number, number][] = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  }

  /**
   * Universal caching layer
   */
  private async getCache(key: string): Promise<string | null> {
    if (this.redis) {
      return await this.redis.get(key);
    } else {
      const entry = this.memoryCache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        return entry.value;
      }
      if (entry) this.memoryCache.delete(key);
      return null;
    }
  }

  private async setCache(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.redis) {
      await this.redis.setex(key, ttlSeconds, value);
    } else {
      this.memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
  }

  /**
   * Exponential backoff request wrapper
   */
  private async requestWithRetry<T>(requestFn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await requestFn();
      } catch (error: any) {
        attempt++;
        // Do not retry 4xx errors except 429
        if (error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
          GoogleMapsErrorHandler.handleError(error);
        }
        if (attempt >= maxRetries) {
          GoogleMapsErrorHandler.handleError(error);
        }
        
        // Exponential backoff: 1s, 2s, 4s...
        const delayMs = Math.pow(2, attempt) * 500;
        console.log(`[GoogleMapsRoutingService] Request failed. Retrying in ${delayMs}ms (Attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('Unreachable');
  }

  /**
   * ComputeRoutes with strict Field Masking and Caching
   */
  public async computeRoutes(
    requestBody: ComputeRoutesRequest, 
    computeFuelConsumption: boolean = false
  ): Promise<ComputeRoutesResponse> {
    if (this.isMockMode) {
      // Return a simulated response
      return {
        routes: [{
          distanceMeters: 5000,
          duration: "900s",
          staticDuration: "800s",
          polyline: { encodedPolyline: "mock_polyline_data" },
          travelAdvisory: {
            fuelConsumptionMicroliters: computeFuelConsumption ? "1500000" : undefined
          }
        }]
      };
    }

    const cacheKey = `computeRoutes:${JSON.stringify(requestBody)}:fuel=${computeFuelConsumption}`;
    const cachedData = await this.getCache(cacheKey);
    
    if (cachedData) {
      console.log('[GoogleMapsRoutingService] Serving computeRoutes from cache');
      return JSON.parse(cachedData) as ComputeRoutesResponse;
    }

    // Strict Field Masking to minimize latency/cost
    let fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.staticDuration';
    if (computeFuelConsumption || requestBody.routingPreference === 'TRAFFIC_AWARE_OPTIMAL') {
      fieldMask += ',routes.travelAdvisory';
    }

    const response = await this.requestWithRetry(() => 
      this.client.post<ComputeRoutesResponse>('/directions/v2:computeRoutes', requestBody, {
        headers: {
          'X-Goog-FieldMask': fieldMask
        }
      })
    );

    // Cache identical requests for 5 minutes
    await this.setCache(cacheKey, JSON.stringify(response.data), 300);

    return response.data;
  }

  /**
   * ComputeRouteMatrix for evaluating travel times between multiple potential destinations
   */
  public async computeRouteMatrix(
    requestBody: ComputeRouteMatrixRequest
  ): Promise<RouteMatrixElement[]> {
    if (this.isMockMode) {
      // Mocking matrix evaluation
      return [{
        originIndex: 0,
        destinationIndex: 0,
        distanceMeters: 1000,
        duration: "300s",
        status: { code: 0, message: "OK" }
      }];
    }

    const cacheKey = `routeMatrix:${JSON.stringify(requestBody)}`;
    const cachedData = await this.getCache(cacheKey);

    if (cachedData) {
      console.log('[GoogleMapsRoutingService] Serving computeRouteMatrix from cache');
      return JSON.parse(cachedData) as RouteMatrixElement[];
    }

    const fieldMask = 'originIndex,destinationIndex,status,duration,distanceMeters,travelAdvisory';

    const response = await this.requestWithRetry(() => 
      this.client.post<RouteMatrixElement[]>('/distanceMatrix/v2:computeRouteMatrix', requestBody, {
        headers: {
          'X-Goog-FieldMask': fieldMask
        }
      })
    );

    await this.setCache(cacheKey, JSON.stringify(response.data), 300);

    return response.data;
  }
}
