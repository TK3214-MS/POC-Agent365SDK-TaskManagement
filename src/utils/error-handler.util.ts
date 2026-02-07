/**
 * Error types for external agent
 */
export enum ErrorType {
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  GITHUB_MODELS = 'GITHUB_MODELS_ERROR',
  GRAPH_API = 'GRAPH_API_ERROR',
  EXTRACTION = 'EXTRACTION_ERROR',
  NETWORK = 'NETWORK_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
}

/**
 * Custom error class for external agent
 */
export class AgentError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AgentError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.type,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error | undefined;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // If error is not retryable, throw immediately
      if (error instanceof AgentError && !error.retryable) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === config.maxAttempts) {
        console.error(
          `❌ ${context} failed after ${config.maxAttempts} attempts:`,
          lastError.message
        );
        throw lastError;
      }

      // Log retry attempt
      console.warn(`⚠️ ${context} failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms...`);

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeoutMs: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  resetTimeoutMs: 60000,
};

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptTime = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new AgentError(
          ErrorType.INTERNAL,
          `Circuit breaker '${this.name}' is OPEN. Retry after ${new Date(this.nextAttemptTime).toISOString()}`,
          503,
          { circuitState: this.state, nextAttemptTime: this.nextAttemptTime },
          false
        );
      }
      // Transition to HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      console.log(`🔄 Circuit breaker '${this.name}' transitioning to HALF_OPEN`);
    }

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new AgentError(
                  ErrorType.NETWORK,
                  `Operation timed out after ${this.config.timeout}ms`,
                  504,
                  undefined,
                  true
                )
              ),
            this.config.timeout
          )
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        console.log(`✅ Circuit breaker '${this.name}' transitioned to CLOSED`);
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.resetTimeoutMs;
      console.error(
        `❌ Circuit breaker '${this.name}' transitioned to OPEN (failures: ${this.failureCount})`
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    nextAttemptTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime: this.nextAttemptTime,
    };
  }
}

/**
 * Global circuit breakers
 */
export const circuitBreakers = {
  githubModels: new CircuitBreaker('GitHubModels', {
    ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
    timeout: 60000, // 60s for LLM operations
  }),
  graphAPI: new CircuitBreaker('GraphAPI', DEFAULT_CIRCUIT_BREAKER_CONFIG),
};
