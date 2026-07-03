import { getDistance } from "./haversine";
export function checkRadius(lat1: number, lon1: number, lat2: number, lon2: number, radius: number): boolean {
  return getDistance(lat1, lon1, lat2, lon2) <= radius;
}
