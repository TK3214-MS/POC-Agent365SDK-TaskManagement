import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AgentError,
  ErrorType,
  retryWithBackoff,
  CircuitBreaker,
  DEFAULT_RETRY_CONFIG,
} from '../../../src/utils/error-handler.util.js';

describe('Error Handler Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('AgentError', () => {
    it('should create error with correct properties', () => {
      const error = new AgentError(
        ErrorType.AUTHENTICATION,
        'Invalid token',
        401,
        { tokenExpired: true },
        false
      );

      expect(error.type).toBe(ErrorType.AUTHENTICATION);
      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
      expect(error.details).toEqual({ tokenExpired: true });
      expect(error.retryable).toBe(false);
      expect(error.name).toBe('AgentError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new AgentError(ErrorType.VALIDATION, 'Invalid input', 400, undefined, false);

      const json = error.toJSON();

      expect(json).toEqual({
        error: ErrorType.VALIDATION,
        message: 'Invalid input',
        statusCode: 400,
        details: undefined,
        retryable: false,
      });
    });

    it('should default statusCode to 500', () => {
      const error = new AgentError(ErrorType.INTERNAL, 'Internal error');

      expect(error.statusCode).toBe(500);
    });

    it('should default retryable to false', () => {
      const error = new AgentError(ErrorType.NETWORK, 'Connection failed', 503);

      expect(error.retryable).toBe(false);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      });

      // Fast-forward timers for retries
      await vi.advanceTimersByTimeAsync(100); // First retry delay
      await vi.advanceTimersByTimeAsync(200); // Second retry delay

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const error = new Error('Persistent failure');
      const operation = vi.fn().mockRejectedValue(error);

      const promise = retryWithBackoff(operation, {
        maxAttempts: 2,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      });

      await vi.advanceTimersByTimeAsync(100); // First retry

      await expect(promise).rejects.toThrow('Persistent failure');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const error = new AgentError(
        ErrorType.VALIDATION,
        'Invalid input',
        400,
        undefined,
        false // not retryable
      );
      const operation = vi.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(operation)).rejects.toThrow('Invalid input');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should apply exponential backoff', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(operation, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 3,
      });

      // First retry: 100ms
      await vi.advanceTimersByTimeAsync(100);
      // Second retry: 300ms (100 * 3)
      await vi.advanceTimersByTimeAsync(300);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect max delay', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');

      const promise = retryWithBackoff(operation, {
        maxAttempts: 2,
        initialDelayMs: 1000,
        maxDelayMs: 500, // Max delay is less than initial
        backoffMultiplier: 2,
      });

      // Should use max delay instead of calculated delay
      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result).toBe('success');
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('CircuitBreaker', () => {
    it('should execute operation when CLOSED', async () => {
      const cb = new CircuitBreaker('test');
      const operation = vi.fn().mockResolvedValue('result');

      const result = await cb.execute(operation);

      expect(result).toBe('result');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should open after failure threshold', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        resetTimeoutMs: 5000,
      });

      const error = new Error('Operation failed');
      const operation = vi.fn().mockRejectedValue(error);

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(operation);
        } catch {
          // Expected
        }
      }

      expect(cb.getState()).toBe('OPEN');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should reject immediately when OPEN', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 1000,
        resetTimeoutMs: 5000,
      });

      // Open the circuit
      try {
        await cb.execute(async () => {
          throw new Error('Fail');
        });
      } catch {
        // Expected
      }

      expect(cb.getState()).toBe('OPEN');

      // Should reject without calling operation
      const operation = vi.fn();
      await expect(cb.execute(operation)).rejects.toThrow('Circuit breaker');
      expect(operation).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 1000,
        resetTimeoutMs: 1000,
      });

      // Open the circuit
      try {
        await cb.execute(async () => {
          throw new Error('Fail');
        });
      } catch {
        // Expected
      }

      expect(cb.getState()).toBe('OPEN');

      // Fast-forward past reset timeout
      await vi.advanceTimersByTimeAsync(1000);

      // Next operation should transition to HALF_OPEN
      const operation = vi.fn().mockResolvedValue('success');
      await cb.execute(operation);

      expect(cb.getState()).toBe('HALF_OPEN');
    });

    it('should transition to CLOSED after success threshold in HALF_OPEN', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 1000,
        resetTimeoutMs: 1000,
      });

      // Open the circuit
      try {
        await cb.execute(async () => {
          throw new Error('Fail');
        });
      } catch {
        // Expected
      }

      // Wait for reset timeout
      await vi.advanceTimersByTimeAsync(1000);

      // Succeed twice to close circuit
      const operation = vi.fn().mockResolvedValue('success');
      await cb.execute(operation);
      expect(cb.getState()).toBe('HALF_OPEN');

      await cb.execute(operation);
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should timeout long-running operations', async () => {
      const cb = new CircuitBreaker('test', {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 100,
        resetTimeoutMs: 5000,
      });

      const operation = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 200); // Longer than timeout
          })
      );

      const promise = cb.execute(operation);

      // Fast-forward past timeout
      await vi.advanceTimersByTimeAsync(100);

      await expect(promise).rejects.toThrow('timed out');
    });

    it('should track statistics correctly', async () => {
      const cb = new CircuitBreaker('test-stats', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        resetTimeoutMs: 5000,
      });

      // Initial state
      let stats = cb.getStats();
      expect(stats.state).toBe('CLOSED');
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);

      // Fail once
      try {
        await cb.execute(async () => {
          throw new Error('Fail');
        });
      } catch {
        // Expected
      }

      stats = cb.getStats();
      expect(stats.failureCount).toBe(1);

      // Succeed once
      await cb.execute(async () => 'success');

      stats = cb.getStats();
      expect(stats.failureCount).toBe(0); // Reset on success
      expect(stats.successCount).toBe(0); // Only counted in HALF_OPEN
    });
  });
});
