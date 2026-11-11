/**
 * Neon Managed Better Auth Client
 * Connects directly to Neon's Auth SDK for email & password authentication.
 */
import { createAuthClient } from "@neon/auth";

export const NEON_AUTH_URL =
  process.env.NEXT_PUBLIC_NEON_AUTH_URL ||
  process.env.NEON_AUTH_BASE_URL ||
  "";

export const neonAuthClient = createAuthClient(NEON_AUTH_URL);
