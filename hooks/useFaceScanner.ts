export function useFaceScanner() {
  return { scan: () => Promise.resolve(true) };
}
