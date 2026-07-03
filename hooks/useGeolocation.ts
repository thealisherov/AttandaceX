import { useState, useEffect } from "react";
export function useGeolocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!navigator.geolocation) {
      if (mounted) setError("Geolocation is not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (mounted) setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }) },
      (err) => { if (mounted) setError(err.message) }
    );
    return () => { mounted = false; };
  }, []);
  return { coords, error };
}
