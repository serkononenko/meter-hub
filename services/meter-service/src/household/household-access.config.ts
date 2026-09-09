/**
 * Where to reach the household service for ownership checks. The base URL
 * comes from the environment (docker-compose wires
 * HOUSEHOLD_SERVICE_URL=http://household-service:8082); there is no default,
 * so a deployment that forgets it fails at startup, not on first request.
 */
export interface HouseholdAccessConfig {
  baseUrl: string;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 3000;

export function loadHouseholdAccessConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): HouseholdAccessConfig {
  const baseUrl = env.HOUSEHOLD_SERVICE_URL;
  if (!baseUrl) {
    throw new Error('HOUSEHOLD_SERVICE_URL must be configured');
  }
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    throw new Error('HOUSEHOLD_SERVICE_URL must be an http(s) base URL');
  }
  const timeoutMs = Number.parseInt(env.HOUSEHOLD_SERVICE_TIMEOUT_MS ?? '', 10);
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}
