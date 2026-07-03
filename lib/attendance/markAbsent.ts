export async function markAbsent(employeeId: string, date: Date): Promise<void> {
  console.log(`Marked ${employeeId} absent on ${date}`);
}
