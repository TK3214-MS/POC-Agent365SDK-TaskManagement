import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Express } from 'express';
import { Server } from 'http';
import messagesRoute from '../../src/routes/messages.route.js';

describe('Messages API Integration Tests', () => {
  let app: Express;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/messages', messagesRoute);

    // Start server on random port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === 'object' && address !== null ? address.port : 3978;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('POST /api/messages', () => {
    describe('Activity Format', () => {
      it('should handle valid Activity request', async () => {
        const activity = {
          type: 'message',
          id: 'test-activity-123',
          conversation: { id: 'conv-123' },
          from: { id: 'user-123', name: 'Test User' },
          recipient: { id: 'bot-123', name: 'Task Agent' },
          text: JSON.stringify({
            meetingTitle: 'Integration Test Meeting',
            meetingTranscript: 'Alice: Let us finalize the plan. Bob: I will review by Friday.',
            attendees: ['Alice', 'Bob'],
            approve: false,
          }),
        };

        const response = await fetch(`${baseUrl}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity),
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.type).toBe('message');
        expect(data.text).toBeDefined();
        expect(data.attachments).toBeDefined();
        expect(Array.isArray(data.attachments)).toBe(true);
      });

      it('should handle Activity with plain text', async () => {
        const activity = {
          type: 'message',
          id: 'test-activity-456',
          conversation: { id: 'conv-456' },
          from: { id: 'user-456', name: 'Test User' },
          recipient: { id: 'bot-456', name: 'Task Agent' },
          text: 'Alice: Review the budget. Bob: Will do by end of week.',
        };

        const response = await fetch(`${baseUrl}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity),
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.type).toBe('message');
        expect(data.text).toBeDefined();
      });

      it('should return error Activity for invalid payload', async () => {
        const activity = {
          type: 'message',
          id: 'test-activity-error',
          conversation: { id: 'conv-error' },
          from: { id: 'user-error' },
          recipient: { id: 'bot-error' },
          text: '{ invalid json',
        };

        const response = await fetch(`${baseUrl}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity),
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.type).toBe('message');
        expect(data.text).toBeDefined();
        // Should contain error message in plain text fallback mode
        expect(typeof data.text).toBe('string');
      });
    });

    describe('JSON Format (with Auth)', () => {
      it('should reject request without authentication', async () => {
        const payload = {
          meetingTitle: 'Test Meeting',
          meetingTranscript: 'Test transcript',
          approve: false,
        };

        const response = await fetch(`${baseUrl}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        expect(response.status).toBe(401);
      });

      it('should reject request with invalid token', async () => {
        const payload = {
          meetingTitle: 'Test Meeting',
          meetingTranscript: 'Test transcript',
          approve: false,
        };

        const response = await fetch(`${baseUrl}/api/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid-token',
          },
          body: JSON.stringify(payload),
        });

        expect(response.status).toBe(401);
      });
    });

    describe('Request Validation', () => {
      it('should validate Activity type field', async () => {
        const invalidActivity = {
          type: 'invalid-type',
          id: 'test',
          conversation: { id: 'test' },
        };

        const response = await fetch(`${baseUrl}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidActivity),
        });

        // Should be treated as JSON format (missing required Activity fields)
        expect(response.status).toBe(401); // No auth for JSON format
      });

      it('should handle missing required fields', async () => {
        const incompleteActivity = {
          type: 'message',
          id: 'test',
          // Missing conversation, from, recipient
        };

        const response = await fetch(`${baseUrl}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(incompleteActivity),
        });

        // Should be treated as JSON format
        expect(response.status).toBe(401);
      });
    });
  });
});
