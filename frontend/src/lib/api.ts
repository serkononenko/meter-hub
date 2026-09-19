/**
 * API access configuration. All requests go through the API gateway, whose
 * base URL is provided at build time via NEXT_PUBLIC_API_URL (see
 * .env.example). A localhost default keeps `next dev` working without setup.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const API_ENDPOINTS = {
  readings: (meterId: string) => `${API_BASE_URL}/api/v1/meters/${meterId}/readings`,
  latestReading: (meterId: string) => `${API_BASE_URL}/api/v1/meters/${meterId}/readings/latest`,
} as const;
