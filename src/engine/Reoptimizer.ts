import { Trip, Segment, OptimizationEvent } from '../types/Trip';
import { GoogleMapsRoutingService } from '../services/GoogleMapsRoutingService';

export class Reoptimizer {
  private routingService: GoogleMapsRoutingService;

  constructor() {
    this.routingService = new GoogleMapsRoutingService();
  }

  /**
   * Re-optimizes a trip based on a real-time event.
   * This is the core Constraint Satisfaction Problem (CSP) solver.
   * 
   * @param trip The current state of the Trip
   * @param event The event that triggered the re-optimization (e.g., flight delay)
   * @returns A Promise resolving to the newly optimized Trip
   */
  public async handleEvent(trip: Trip, event: OptimizationEvent): Promise<Trip> {
    console.log(`[Reoptimizer] Received event: ${event.type} for trip: ${trip.tripId}`);
    
    // 1. Identify impacted segments based on the event
    const impactedSegments = this.identifyImpactedSegments(trip, event);
    
    if (impactedSegments.length === 0) {
      console.log(`[Reoptimizer] No segments impacted. No re-routing needed.`);
      return trip;
    }

    // 2. Drop impacted segments and any dependent downstream segments
    let updatedTrip = this.dropSegments(trip, impactedSegments);

    // 3. Re-calculate constraints (e.g., remaining budget, time available)
    const remainingBudget = this.calculateRemainingBudget(updatedTrip);
    const availableTimeSlots = this.findAvailableTimeSlots(updatedTrip);

    // 4. Generate new alternatives using Google Services & Vertex AI constraints
    // (Mocked for this boilerplate)
    const newSegments = await this.generateAlternatives(updatedTrip.constraints, remainingBudget, availableTimeSlots);

    // 5. Insert new segments into the itinerary, ensuring no overlaps
    updatedTrip = this.insertSegments(updatedTrip, newSegments);

    return updatedTrip;
  }

  private identifyImpactedSegments(trip: Trip, event: OptimizationEvent): string[] {
    const impactedIds: string[] = [];

    // Example logic: if a venue closes, find the segment with that venue
    if (event.type === 'VENUE_CLOSURE') {
      const closedPlaceId = event.payload.placeId;
      trip.itinerary.forEach(segment => {
        if (segment.placeId === closedPlaceId && segment.status !== 'COMPLETED') {
          impactedIds.push(segment.segmentId);
        }
      });
    }

    // Example logic: Geofence trigger - if user is too far away to make the next segment
    if (event.type === 'GEOFENCE_TRIGGER') {
      // Logic to check distance vs time until next segment
      // Here we mock that the upcoming segment is impacted
      const nextSegment = trip.itinerary.find(s => s.status === 'UPCOMING');
      if (nextSegment) impactedIds.push(nextSegment.segmentId);
    }

    // Adaptive Optimization Trigger: Traffic-aware duration increase > 15%
    if (event.type === 'TRAFFIC_UPDATE' && event.payload.origin && event.payload.destination) {
      // In a real scenario, we would call the routing service here
      // For boilerplate, we mock a 20% delay detection if event passes delayMinutes
      const originalDurationMinutes = 60; // Mock 1 hour
      const currentDelay = event.payload.delayMinutes || 0;
      
      if (currentDelay / originalDurationMinutes > 0.15) {
        console.log(`[Reoptimizer] Traffic duration increased by >15%. RE-ROUTE_REQUIRED triggered.`);
        // Mark the upcoming segments as impacted
        const nextSegment = trip.itinerary.find(s => s.status === 'UPCOMING');
        if (nextSegment) impactedIds.push(nextSegment.segmentId);
      }
    }

    return impactedIds;
  }

  private dropSegments(trip: Trip, segmentIdsToDrop: string[]): Trip {
    const newItinerary = trip.itinerary.filter(segment => !segmentIdsToDrop.includes(segment.segmentId));
    return { ...trip, itinerary: newItinerary };
  }

  private calculateRemainingBudget(trip: Trip): number {
    const spent = trip.itinerary
      .filter(s => s.status === 'COMPLETED' || s.status === 'ACTIVE')
      .reduce((acc, curr) => acc + (curr.cost || 0), 0);
    return trip.constraints.budgetMax - spent;
  }

  private findAvailableTimeSlots(trip: Trip): Array<{ start: string; end: string }> {
    // In a real scenario, this would check against the user's Google Calendar and the trip schedule.
    // Mock returning a single 4-hour block available later today.
    return [
      {
        start: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        end: new Date(Date.now() + 18000000).toISOString() // 5 hours from now
      }
    ];
  }

  private async generateAlternatives(
    constraints: Trip['constraints'], 
    budget: number, 
    slots: Array<{ start: string; end: string }>
  ): Promise<Segment[]> {
    // This is where we would call the GoogleServiceFetcher and Vertex AI.
    // We mock the response to fit within the constraints.
    console.log(`[Reoptimizer] Generating alternatives for vibes: ${constraints.vibes.join(', ')} with budget $${budget}`);
    
    return [
      {
        segmentId: `seg_new_${Date.now()}`,
        type: 'EXPERIENCE',
        status: 'UPCOMING',
        name: 'Dynamic Replacement Venue',
        placeId: 'ChIJ_mock_place_id_123',
        startTime: slots[0].start,
        endTime: slots[0].end,
        cost: Math.min(budget, 25.00), // Ensure it fits budget
      }
    ];
  }

  private insertSegments(trip: Trip, newSegments: Segment[]): Trip {
    // Sort segments chronologically
    const combined = [...trip.itinerary, ...newSegments];
    combined.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return { ...trip, itinerary: combined };
  }
}
