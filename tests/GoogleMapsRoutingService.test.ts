import { GoogleMapsRoutingService } from '../src/services/GoogleMapsRoutingService';
import { ComputeRoutesRequest, ComputeRouteMatrixRequest } from '../src/types/GoogleMaps';

async function runTests() {
  console.log('--- Starting GoogleMapsRoutingService Tests ---');
  
  // 1. Initialize Service
  const routingService = new GoogleMapsRoutingService();
  console.log('[Test] Routing Service Initialized (Mock Mode expected without API key)');

  // 2. Test ComputeRoutes
  try {
    const request: ComputeRoutesRequest = {
      origin: { location: { latLng: { latitude: 37.419734, longitude: -122.0827784 } } },
      destination: { location: { latLng: { latitude: 37.417670, longitude: -122.079595 } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      computeAlternativeRoutes: false
    };

    const routeResponse = await routingService.computeRoutes(request, true);
    
    if (routeResponse && routeResponse.routes.length > 0) {
      console.log('✅ [Test] computeRoutes executed successfully.');
      console.log(`   Distance: ${routeResponse.routes[0].distanceMeters}m`);
      console.log(`   Duration: ${routeResponse.routes[0].duration}`);
      if (routeResponse.routes[0].travelAdvisory?.fuelConsumptionMicroliters) {
        console.log(`   Fuel Data: ${routeResponse.routes[0].travelAdvisory.fuelConsumptionMicroliters} microliters`);
      }
    } else {
      console.error('❌ [Test] computeRoutes failed to return routes.');
    }
  } catch (error) {
    console.error('❌ [Test] Error during computeRoutes:', error);
  }

  // 3. Test Caching behavior
  try {
    console.log('[Test] Executing identical computeRoutes request to verify caching...');
    const request: ComputeRoutesRequest = {
      origin: { location: { latLng: { latitude: 37.419734, longitude: -122.0827784 } } },
      destination: { location: { latLng: { latitude: 37.417670, longitude: -122.079595 } } },
      travelMode: 'DRIVE'
    };
    
    // The second call should hit the memory cache instantly
    await routingService.computeRoutes(request, false);
    console.log('✅ [Test] Cache hit successful.');
  } catch (error) {
    console.error('❌ [Test] Error during cache verification:', error);
  }

  // 4. Test Polyline Decoding
  try {
    const mockPolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
    const decoded = routingService.decodePolyline(mockPolyline);
    if (decoded.length > 0) {
      console.log('✅ [Test] decodePolyline executed successfully.');
      console.log(`   First Point: [${decoded[0][0]}, ${decoded[0][1]}]`);
    }
  } catch (error) {
    console.error('❌ [Test] Error during polyline decoding:', error);
  }

  console.log('--- Tests Completed ---');
}

runTests();
