export function useAttendance() {
  return { attendance: [], checkIn: () => Promise.resolve(), checkOut: () => Promise.resolve() };
}
