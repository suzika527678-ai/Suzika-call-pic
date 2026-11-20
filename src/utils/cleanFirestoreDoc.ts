/**
 * Clean object before saving to Firestore to prevent
 * "Unsupported field value: undefined" errors.
 */
export function cleanFirestoreDoc<T extends Record<string, any>>(obj: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleaned[key] = val;
    }
  }
  return cleaned;
}
