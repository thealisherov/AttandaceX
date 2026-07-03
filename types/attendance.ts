export interface Attendance {
  id: string;
  employeeId: string;
  checkIn: Date;
  checkOut?: Date;
}
