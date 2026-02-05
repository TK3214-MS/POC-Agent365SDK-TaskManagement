import { describe, it, expect, vi } from 'vitest';
import { traceActivity, logActivity } from '../../../src/services/agent365/observability';
import { Activity } from '@microsoft/agents-activity';
import { trace } from '@opentelemetry/api';

vi.mock('@opentelemetry/api');

describe('Agent365 Observability', () => {
  describe('traceActivity', () => {
    it('should trace successful activity processing', async () => {
      const mockSpan = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
        recordException: vi.fn(),
        spanContext: vi.fn(() => ({ traceId: 'test-trace-id' })),
      };

      const mockTracer = {
        startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
      };

      vi.mocked(trace.getTracer).mockReturnValue(mockTracer as any);

      const result = await traceActivity('message', async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('agent365.activity_type', 'message');
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 0 });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record exception on failure', async () => {
      const mockSpan = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
        recordException: vi.fn(),
        spanContext: vi.fn(() => ({ traceId: 'test-trace-id' })),
      };

      const mockTracer = {
        startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
      };

      vi.mocked(trace.getTracer).mockReturnValue(mockTracer as any);

      const error = new Error('Test error');

      await expect(
        traceActivity('message', async () => {
          throw error;
        })
      ).rejects.toThrow('Test error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 2, message: 'Test error' });
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('logActivity', () => {
    it('should log incoming activity', () => {
      const mockSpan = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
      };

      const mockTracer = {
        startSpan: vi.fn(() => mockSpan),
      };

      vi.mocked(trace.getTracer).mockReturnValue(mockTracer as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const activity: Activity = {
        type: 'message',
        id: 'test-123',
        conversation: { id: 'conv-123' },
      };

      logActivity(activity, 'incoming');

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('activity.id', 'test-123');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('activity.type', 'message');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('activity.direction', 'incoming');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Agent365 Observability] INCOMING Activity:',
        expect.objectContaining({
          id: 'test-123',
          type: 'message',
        })
      );

      consoleSpy.mockRestore();
    });
  });
});
