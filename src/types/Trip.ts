export interface Location {
  lat: number;
  lng: number;
  lastUpdated: string;
}

export interface Constraints {
  budgetMax: number;
  currency: string;
  vibes: string[];
  mobilityRequirements: string[];
}

export interface Segment {
  segmentId: string;
  type: 'TRANSIT' | 'EXPERIENCE' | 'LODGING';
  status: 'COMPLETED' | 'ACTIVE' | 'UPCOMING' | 'CANCELLED';
  provider?: string;
  startTime: string;
  endTime: string;
  cost?: number;
  name?: string;
  placeId?: string;
  details?: Record<string, any>;
}

export interface Trip {
  tripId: string;
  userId: string;
  status: 'ACTIVE' | 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  constraints: Constraints;
  schedule: {
    startTime: string;
    endTime: string;
  };
  currentLocation: Location;
  itinerary: Segment[];
}

export interface OptimizationEvent {
  type: 'FLIGHT_DELAY' | 'VENUE_CLOSURE' | 'USER_PREFERENCE_CHANGE' | 'GEOFENCE_TRIGGER';
  payload: Record<string, any>;
  timestamp: string;
}
