import { Trip, Segment } from '../types/Trip';

export class TripPlanner {
  /**
   * Generates a brand new trip based on user constraints.
   */
  public async generateTrip(
    destination: string,
    startDate: string,
    endDate: string,
    budget: number = 1000
  ): Promise<Trip> {
    console.log(`[TripPlanner] Generating trip to ${destination} from ${startDate} to ${endDate}`);
    
    // In a real application, this would call Vertex AI and Google Places to build a full itinerary.
    // Here we generate a mocked itinerary based on the destination.
    
    const start = new Date(startDate).getTime();
    const mockSegments: Segment[] = [
      {
        segmentId: `flight_${Date.now()}`,
        type: 'TRANSIT',
        status: 'UPCOMING',
        name: `Flight to ${destination}`,
        cost: budget * 0.4, // Flight is 40% of budget
        startTime: new Date(start).toISOString(),
        endTime: new Date(start + 18000000).toISOString() // 5 hours flight
      },
      {
        segmentId: `hotel_${Date.now()}`,
        type: 'LODGING',
        status: 'UPCOMING',
        name: `Central Hotel ${destination}`,
        cost: budget * 0.3,
        startTime: new Date(start + 21600000).toISOString(),
        endTime: new Date(endDate).toISOString()
      },
      {
        segmentId: `exp_${Date.now()}`,
        type: 'EXPERIENCE',
        status: 'UPCOMING',
        name: `Sightseeing in ${destination}`,
        cost: budget * 0.1,
        startTime: new Date(start + 86400000).toISOString(), // Next day
        endTime: new Date(start + 100800000).toISOString() // +4 hours
      }
    ];

    return {
      tripId: `trip_${Date.now()}`,
      userId: 'user_1',
      status: 'ACTIVE',
      constraints: {
        budgetMax: budget,
        currency: 'USD',
        vibes: ['sightseeing', 'local_culture'],
        mobilityRequirements: []
      },
      schedule: {
        startTime: startDate,
        endTime: endDate
      },
      currentLocation: { lat: 0, lng: 0, lastUpdated: new Date().toISOString() }, // Needs Geocoding for real dest
      itinerary: mockSegments
    };
  }
}
