import { useState, useEffect } from 'react';

export interface Location {
  lat: number;
  lon: number;
  accuracy?: number;
}

export interface GeolocationResult {
  location: Location | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean | null;
  detectLocation: () => Promise<void>;
}

export const useGeolocation = (): GeolocationResult => {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  // Check if browser supports geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setPermissionGranted(false);
    } else {
      setPermissionGranted(true);
    }
  }, []);

  const detectLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes cache
        });
      });

      const newLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      setLocation(newLocation);
    } catch (err) {
      console.error('Geolocation error:', err);
      
      let errorMessage = 'Failed to get your location';
      if ((err as GeolocationPositionError).code === 1) {
        errorMessage = 'Permission denied. Please allow location access.';
      } else if ((err as GeolocationPositionError).code === 2) {
        errorMessage = 'Location unavailable.';
      } else if ((err as GeolocationPositionError).code === 3) {
        errorMessage = 'Location request timed out.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { location, loading, error, permissionGranted, detectLocation };
};