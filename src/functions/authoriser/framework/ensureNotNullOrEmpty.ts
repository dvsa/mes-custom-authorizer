export default function ensureNotNullOrEmpty(val: any, fieldName: string): void {
  if (val === null || val === undefined || val === '') {
    throw new Error(`${fieldName} is null or empty`);
  }
}
