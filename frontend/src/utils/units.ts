export function cmToInches(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round((kg / 0.453592) * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

export function ageBasedMaxHR(age: number): number | null {
  if (age > 0 && age < 120) return 220 - age;
  return null;
}
