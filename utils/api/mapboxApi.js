import axios from 'axios';
import logger from '../logger';

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiYW5pcnVkaGtyaXNobmEwNiIsImEiOiJjbWlzaWcyMXUwMGE4M2VzYzl2eWd3azhvIn0.7XcoROUHyoPMgrQ-NwNyag'; // Get from https://account.mapbox.com/
const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

export const getRoutePolyline = async (coordinates) => {
  if (!coordinates || coordinates.length < 2) {
    logger.info('getRoutePolyline called with insufficient coordinates', coordinates);
    return coordinates; // Return as-is if less than 2 coordinates
  }

  try {
    logger.info('Requesting Mapbox polyline for', coordinates.length, 'points');
    // Format coordinates for Mapbox API
    const coordsString = coordinates
      .map(coord => `${coord.longitude},${coord.latitude}`)
      .join(';');

    const response = await axios.get(MAPBOX_DIRECTIONS_URL, {
      params: {
        geometries: 'geojson',
        access_token: MAPBOX_ACCESS_TOKEN,
        overview: 'full',
        steps: false,
      },
      url: `${MAPBOX_DIRECTIONS_URL}/${coordsString}`,
    });

    if (response.data.routes && response.data.routes.length > 0) {
      // Convert GeoJSON to coordinates array
      const geojson = response.data.routes[0].geometry;
      logger.info('Mapbox response received, geometry type:', geojson.type);
      if (geojson.type === 'LineString') {
        return geojson.coordinates.map(coord => ({
          longitude: coord[0],
          latitude: coord[1],
        }));
      }
    }
    
    // Fallback to straight line coordinates
    logger.warn('Mapbox did not return a route, falling back to straight-line coords');
    return coordinates;
  } catch (error) {
    logger.error('Error fetching Mapbox route:', error);
    
    // Fallback: Use straight lines between coordinates
    return coordinates;
  }
};

// For development without Mapbox token
export const getMockPolyline = (coordinates) => {
  if (!coordinates || coordinates.length < 2) {
    return coordinates;
  }

  // Generate intermediate points for a smoother line
  const polyline = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    
    polyline.push(start);
    
    // Add some intermediate points for a curved appearance
    const steps = 5;
    for (let j = 1; j < steps; j++) {
      const t = j / steps;
      polyline.push({
        latitude: start.latitude + (end.latitude - start.latitude) * t,
        longitude: start.longitude + (end.longitude - start.longitude) * t,
      });
    }
  }
  
  polyline.push(coordinates[coordinates.length - 1]);
  return polyline;
};

export default { getRoutePolyline, getMockPolyline };