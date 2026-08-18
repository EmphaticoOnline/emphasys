const COMPASS_HOSTNAME = 'compass.emphasys.cloud';

export function isCompassHostname(hostname: string): boolean {
  return hostname.trim().toLowerCase() === COMPASS_HOSTNAME;
}

