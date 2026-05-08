export interface Location {
  latLng: {
    latitude: number;
    longitude: number;
  };
}

export interface Waypoint {
  location: Location;
}

export interface ComputeRoutesRequest {
  origin: Waypoint;
  destination: Waypoint;
  intermediates?: Waypoint[];
  travelMode: 'DRIVE' | 'BICYCLE' | 'WALK' | 'TWO_WHEELER' | 'TRANSIT';
  routingPreference?: 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL';
  computeAlternativeRoutes?: boolean;
  routeModifiers?: {
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    avoidFerries?: boolean;
  };
  languageCode?: string;
  units?: 'METRIC' | 'IMPERIAL';
  requestedReferenceRoutes?: string[]; // e.g., ['FUEL_EFFICIENT']
}

export interface TravelAdvisory {
  tollInfo?: {
    estimatedPrice: {
      currencyCode: string;
      units: string;
      nanos: number;
    }[]
  };
  speedReadingIntervals?: {
    startPolylinePointIndex: number;
    endPolylinePointIndex: number;
    speed: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';
  }[];
  fuelConsumptionMicroliters?: string;
}

export interface Route {
  distanceMeters: number;
  duration: string; // e.g. "1000s"
  staticDuration: string; // duration without traffic
  polyline: {
    encodedPolyline: string;
  };
  description?: string;
  warnings?: string[];
  viewport?: {
    low: Location['latLng'];
    high: Location['latLng'];
  };
  travelAdvisory?: TravelAdvisory;
  routeToken?: string;
}

export interface ComputeRoutesResponse {
  routes: Route[];
  fallbackInfo?: {
    routingMode: 'FALLBACK_ROUTING_MODE_UNSPECIFIED' | 'FALLBACK_TRAFFIC_UNAWARE' | 'FALLBACK_TRAFFIC_AWARE';
    reason: 'FALLBACK_REASON_UNSPECIFIED' | 'SERVER_ERROR' | 'LATENCY_EXCEEDED';
  };
}

// Route Matrix Types
export interface RouteMatrixOrigin {
  waypoint: Waypoint;
  routeModifiers?: ComputeRoutesRequest['routeModifiers'];
}

export interface RouteMatrixDestination {
  waypoint: Waypoint;
}

export interface ComputeRouteMatrixRequest {
  origins: RouteMatrixOrigin[];
  destinations: RouteMatrixDestination[];
  travelMode: ComputeRoutesRequest['travelMode'];
  routingPreference?: ComputeRoutesRequest['routingPreference'];
}

export interface RouteMatrixElement {
  originIndex: number;
  destinationIndex: number;
  status?: {
    code: number;
    message: string;
  };
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;
  travelAdvisory?: TravelAdvisory;
  fallbackInfo?: ComputeRoutesResponse['fallbackInfo'];
}
