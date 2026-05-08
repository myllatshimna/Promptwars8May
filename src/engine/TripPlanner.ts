import { Trip, Segment } from '../types/Trip';

export class TripPlanner {
  /**
   * Generates a brand new trip based on user constraints.
   */
  public async generateTrip(
    destination: string,
    startDate: string,
    endDate: string,
    budget: number = 1000,
    purpose: string = 'Culture'
  ): Promise<Trip> {
    console.log(`[TripPlanner] Generating trip to ${destination} from ${startDate} to ${endDate} for ${purpose} with budget $${budget}`);
    
    const start = new Date(startDate).getTime();
    
    // Heuristic Recommendation Engine
    let hotelName = `Central Hotel ${destination}`;
    let hotelCost = budget * 0.3;
    let experienceName = `Sightseeing in ${destination}`;
    let experienceCost = budget * 0.1;
    let restaurantName = `Local Eats in ${destination}`;
    let restaurantCost = budget * 0.1;

    // Adjust based on Budget
    const isHighBudget = budget > 2000;
    const isLowBudget = budget <= 800;

    if (isHighBudget) {
      hotelName = `Aman Resort ${destination}`;
      hotelCost = budget * 0.4;
    } else if (isLowBudget) {
      hotelName = `${destination} Backpacker Hostel`;
      hotelCost = budget * 0.15;
    }

    // Adjust based on Purpose
    switch (purpose) {
      case 'Foodie':
        experienceName = `${destination} Street Food Walking Tour`;
        if (isHighBudget) {
          experienceName = `Michelin Star Truffle Tasting in ${destination}`;
        }
        restaurantName = `Chef's Table at The Grand ${destination}`;
        restaurantCost = budget * 0.2;
        break;
      case 'Culture':
        experienceName = `${destination} National Museum & History Walk`;
        restaurantName = `Traditional Heritage Dining ${destination}`;
        break;
      case 'Adventure':
        experienceName = `Guided Hike & Zipline ${destination}`;
        if (isHighBudget) {
          experienceName = `Private Helicopter Tour over ${destination}`;
        }
        break;
      case 'Luxury':
        experienceName = `Private Spa Retreat ${destination}`;
        if (isHighBudget) {
          hotelName = `Presidential Suite at ${destination} Four Seasons`;
        }
        break;
      case 'Budget':
        experienceName = `Free Self-Guided Walking Tour of ${destination}`;
        experienceCost = 0;
        restaurantName = `Local Market Street Food ${destination}`;
        restaurantCost = budget * 0.05;
        break;
    }

    const mockSegments: Segment[] = [
      {
        segmentId: `flight_${Date.now()}`,
        type: 'TRANSIT',
        status: 'UPCOMING',
        name: `Flight to ${destination}`,
        cost: budget * 0.3, 
        startTime: new Date(start).toISOString(),
        endTime: new Date(start + 18000000).toISOString() // 5 hours flight
      },
      {
        segmentId: `hotel_${Date.now()}`,
        type: 'LODGING',
        status: 'UPCOMING',
        name: hotelName,
        cost: hotelCost,
        startTime: new Date(start + 21600000).toISOString(),
        endTime: new Date(endDate).toISOString()
      },
      {
        segmentId: `exp_${Date.now()}`,
        type: 'EXPERIENCE',
        status: 'UPCOMING',
        name: experienceName,
        cost: experienceCost,
        startTime: new Date(start + 86400000).toISOString(), // Next day
        endTime: new Date(start + 100800000).toISOString() // +4 hours
      },
      {
        segmentId: `dine_${Date.now()}`,
        type: 'EXPERIENCE',
        status: 'UPCOMING',
        name: restaurantName,
        cost: restaurantCost,
        startTime: new Date(start + 115200000).toISOString(), // Later that evening
        endTime: new Date(start + 122400000).toISOString() // +2 hours
      }
    ];

    return {
      tripId: `trip_${Date.now()}`,
      userId: 'user_1',
      status: 'ACTIVE',
      constraints: {
        budgetMax: budget,
        currency: 'USD',
        vibes: [purpose.toLowerCase()],
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
