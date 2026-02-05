import { describe, it, expect, vi } from 'vitest';
import {
  sendNotification,
  sendMeetingSummaryNotification,
} from '../../../src/services/agent365/notifications';
import { trace } from '@opentelemetry/api';

vi.mock('@opentelemetry/api');

describe('Agent365 Notifications', () => {
  describe('sendNotification', () => {
    it('should send notification with correct attributes', async () => {
      const mockSpan = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
        spanContext: vi.fn(() => ({ traceId: 'test-trace-id' })),
      };

      const mockTracer = {
        startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
      };

      vi.mocked(trace.getTracer).mockReturnValue(mockTracer as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await sendNotification({
        title: 'Test Notification',
        body: 'Test body',
        priority: 'high',
        data: { key: 'value' },
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('notification.title', 'Test Notification');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('notification.priority', 'high');
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 0 });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Agent365 Notifications] Sending notification:',
        expect.objectContaining({
          title: 'Test Notification',
          priority: 'high',
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('sendMeetingSummaryNotification', () => {
    it('should send meeting summary with high priority when risks exist', async () => {
      const mockSpan = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
        spanContext: vi.fn(() => ({ traceId: 'test-trace-id' })),
      };

      const mockTracer = {
        startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
      };

      vi.mocked(trace.getTracer).mockReturnValue(mockTracer as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await sendMeetingSummaryNotification('Test Meeting', 5, 2, 3);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'notification.title',
        'Meeting Summary: Test Meeting'
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('notification.priority', 'high');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Agent365 Notifications] Sending notification:',
        expect.objectContaining({
          title: 'Meeting Summary: Test Meeting',
          priority: 'high',
        })
      );

      consoleSpy.mockRestore();
    });

    it('should send meeting summary with normal priority when no risks', async () => {
      const mockSpan = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
        spanContext: vi.fn(() => ({ traceId: 'test-trace-id' })),
      };

      const mockTracer = {
        startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
      };

      vi.mocked(trace.getTracer).mockReturnValue(mockTracer as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await sendMeetingSummaryNotification('Safe Meeting', 3, 0, 2);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('notification.priority', 'normal');

      consoleSpy.mockRestore();
    });
  });
});
