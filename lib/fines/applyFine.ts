export async function applyFine(employeeId: string, amount: number, reason: string): Promise<void> {
  console.log(`Applied fine to ${employeeId}: ${amount} for ${reason}`);
}
