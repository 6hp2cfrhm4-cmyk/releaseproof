import { describe, expect, it } from 'vitest';
import { detectExternalServiceDependency, detectMissingRequiredEnvironment } from '../checks/external-services.js';

describe('external service failure classification', () => {
  it('recognizes a missing Drizzle Postgres URL during build', () => {
    const log = "Please provide required params for Postgres driver:\n    [x] url: ''";
    expect(detectExternalServiceDependency(log)?.name).toBe('PostgreSQL');
  });

  it('does not classify an unrelated build error as missing infrastructure', () => {
    expect(detectExternalServiceDependency('TypeError: Cannot read properties of undefined')).toBeNull();
  });

  it('recognizes framework validation of absent environment values', () => {
    expect(detectMissingRequiredEnvironment("Invalid environment variables: {\n  DATABASE_URL: [ 'Required' ]\n}")).toBe(true);
    expect(detectMissingRequiredEnvironment('TypeError: Invalid environment variables helper failed')).toBe(false);
  });
});
