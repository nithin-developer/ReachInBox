import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  windowKey: string;
  nextWindowTime: Date;
  retryAfterSeconds: number;
}

/**
 * Get current UTC hour window string (e.g. 2026-09-27-14)
 * Ensures consistency across distributed workers and servers
 */
export const getHourWindowKey = (date: Date = new Date()): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
};

/**
 * Calculate the exact Date when the next UTC hourly window starts
 */
export const getNextHourWindowTime = (date: Date = new Date()): Date => {
  const nextHour = new Date(date);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  return nextHour;
};

/**
 * Atomic Lua Script for Check-and-Increment Rate Limiting
 *
 * Keys:
 *  1: ratelimit:sender:{senderEmail}:{windowKey}
 *
 * Args:
 *  1: limit (e.g. 20)
 *  2: ttlSeconds (e.g. 7200)
 *
 * Returns:
 *  0 -> Limit reached (currentCount >= limit). Counter is NOT incremented.
 *  N -> Allowed (1 <= N <= limit).
 */
const CHECK_AND_INCREMENT_LUA = `
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
local limit = tonumber(ARGV[1])

if current >= limit then
  return 0
end

local nextVal = redis.call("INCR", KEYS[1])

if nextVal == 1 then
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
end

return nextVal
`;

/**
 * Atomic Redis-backed Hourly Rate Limiter for Senders
 *
 * Ensures:
 * 1. Strictly atomic test-and-set using Redis Lua scripting.
 * 2. Counter stops exactly at `hourlyLimit` without overcounting.
 * 3. Exact next-window resumption calculation.
 */
export const checkAndIncrementSenderLimit = async (
  senderEmail: string,
  hourlyLimit: number
): Promise<RateLimitResult> => {
  const now = new Date();
  const windowKey = getHourWindowKey(now);
  const redisKey = `ratelimit:sender:${senderEmail.toLowerCase()}:${windowKey}`;
  const nextWindowTime = getNextHourWindowTime(now);
  const retryAfterSeconds = Math.max(1, Math.ceil((nextWindowTime.getTime() - now.getTime()) / 1000));
  const ttlSeconds = 7200; // 2 hours TTL ensures cleanup after window expiry

  try {
    // Execute atomic Lua script
    const result = (await redis.eval(
      CHECK_AND_INCREMENT_LUA,
      1,
      redisKey,
      hourlyLimit,
      ttlSeconds
    )) as number;

    if (result === 0) {
      // Limit was reached; counter remained at limit
      logger.warn(
        {
          senderEmail,
          currentCount: hourlyLimit,
          hourlyLimit,
          windowKey,
          nextWindow: nextWindowTime.toISOString(),
        },
        'Sender hourly rate limit REACHED. Email queued for next hour window.'
      );

      return {
        allowed: false,
        currentCount: hourlyLimit,
        limit: hourlyLimit,
        windowKey,
        nextWindowTime,
        retryAfterSeconds,
      };
    }

    // Allowed (result is 1..hourlyLimit)
    logger.debug(
      { senderEmail, currentCount: result, hourlyLimit, windowKey },
      'Sender within hourly rate limit'
    );

    return {
      allowed: true,
      currentCount: result,
      limit: hourlyLimit,
      windowKey,
      nextWindowTime,
      retryAfterSeconds: 0,
    };
  } catch (error: any) {
    logger.error(
      { senderEmail, error: error.message },
      'Redis rate limit Lua execution error. Failing safe.'
    );
    // In case of unexpected Redis error, allow to avoid dropping
    return {
      allowed: true,
      currentCount: 1,
      limit: hourlyLimit,
      windowKey,
      nextWindowTime,
      retryAfterSeconds: 0,
    };
  }
};

/**
 * Acquire a one-time Slack alert lock for this sender in the current hour window.
 * Uses Redis SET NX EX so only the FIRST breach per window returns true.
 */
export const acquireRateLimitAlertLock = async (
  senderEmail: string,
  windowKey: string
): Promise<boolean> => {
  const lockKey = `ratelimit:notified:${senderEmail.toLowerCase()}:${windowKey}`;
  // Returns 'OK' if key was set (first time), null if key already exists
  const acquired = await redis.set(lockKey, '1', 'EX', 7200, 'NX');
  return acquired === 'OK';
};

/**
 * Get current rate limit usage for a sender
 */
export const getSenderHourlyUsage = async (senderEmail: string): Promise<number> => {
  const windowKey = getHourWindowKey();
  const redisKey = `ratelimit:sender:${senderEmail.toLowerCase()}:${windowKey}`;
  const val = await redis.get(redisKey);
  return val ? parseInt(val, 10) : 0;
};
