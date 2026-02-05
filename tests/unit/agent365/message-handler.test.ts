import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent365MessageHandler } from '../../../src/services/agent365/message-handler';
import { Activity } from '@microsoft/agents-activity';
import * as extractionService from '../../../src/services/llm/extraction.service';
import * as graphClient from '../../../src/services/graph/graph.client';
import * as githubModelsService from '../../../src/services/llm/github-models.service';

// Mock dependencies BEFORE importing modules that use env
vi.mock('../../../src/config/env', () => ({
  env: {
    TENANT_ID: 'test-tenant',
    API_CLIENT_ID: 'test-client-id',
    API_AUDIENCE: 'test-audience',
    REQUIRED_SCOPES: 'test-scope',
    REQUIRED_ROLES: 'test-role',
    ALLOWED_APPIDS: 'test-appid',
    GITHUB_TOKEN: 'test-token',
    GITHUB_MODELS_LIST: 'gpt-4o',
    GRAPH_CLIENT_ID: 'test-graph-client',
    GRAPH_CLIENT_SECRET: 'test-secret',
    GRAPH_TENANT_ID: 'test-tenant',
    PLANNER_PLAN_ID: 'test-plan',
    PLANNER_BUCKET_ID: 'test-bucket',
  },
}));

vi.mock('../../../src/services/llm/github-models.service');
vi.mock('../../../src/services/llm/extraction.service');
vi.mock('../../../src/services/graph/graph.client');
vi.mock('../../../src/services/actions/action.executor');

describe('Agent365MessageHandler', () => {
  let handler: Agent365MessageHandler;

  beforeEach(() => {
    handler = new Agent365MessageHandler();

    // Mock extraction service
    vi.spyOn(extractionService, 'extractMeetingData').mockResolvedValue({
      executiveSummary: {
        progress: 'Good progress',
        keyRisks: [],
        nextSteps: [],
      },
      decisions: [
        {
          text: 'Adopt new framework',
          owner: 'Alice',
          confidence: 0.95,
          metadata: {},
        },
      ],
      todos: [
        {
          text: 'Update documentation',
          owner: 'Bob',
          dueDate: '2025-06-01',
          confidence: 0.9,
          metadata: {},
        },
      ],
      risks: [],
      followUpQuestions: [],
      metadata: {
        modelUsed: 'gpt-4o',
        tokensUsed: { input: 100, output: 50 },
        processingTimeMs: 500,
      },
    });

    vi.spyOn(extractionService, 'enrichTodos').mockImplementation((todos) => todos);
  });

  it('should handle Activity with JSON payload', async () => {
    const activity: Activity = {
      type: 'message',
      id: 'test-123',
      conversation: { id: 'conv-123' },
      from: { id: 'user-123', name: 'Test User' },
      recipient: { id: 'bot-123', name: 'Test Bot' },
      text: JSON.stringify({
        meetingTitle: 'Test Meeting',
        meetingTranscript: 'We discussed the new feature.',
        approve: false,
      }),
    };

    const response = await handler.handleActivity(activity);

    expect(response.type).toBe('message');
    expect(response.from).toEqual(activity.recipient);
    expect(response.recipient).toEqual(activity.from);
    expect(response.text).toContain('Meeting Summary');
    expect(response.text).toContain('Adopt new framework');
  });

  it('should handle Activity with plain text', async () => {
    const activity: Activity = {
      type: 'message',
      id: 'test-456',
      conversation: { id: 'conv-456' },
      from: { id: 'user-456', name: 'Test User' },
      recipient: { id: 'bot-456', name: 'Test Bot' },
      text: 'This is a plain text meeting transcript.',
    };

    const response = await handler.handleActivity(activity);

    expect(response.type).toBe('message');
    expect(response.text).toContain('Meeting Summary');
    expect(extractionService.extractMeetingData).toHaveBeenCalledWith(
      'Untitled Meeting',
      'This is a plain text meeting transcript.',
      [],
      'ja-JP',
      7,
      undefined
    );
  });

  it('should handle invalid payload', async () => {
    const activity: Activity = {
      type: 'message',
      id: 'test-789',
      conversation: { id: 'conv-789' },
      from: { id: 'user-789', name: 'Test User' },
      recipient: { id: 'bot-789', name: 'Test Bot' },
      text: JSON.stringify({ invalid: 'data' }),
    };

    const response = await handler.handleActivity(activity);

    expect(response.type).toBe('message');
    expect(response.text).toContain('Invalid request format');
  });

  it('should return error response on exception', async () => {
    vi.spyOn(extractionService, 'extractMeetingData').mockRejectedValue(
      new Error('Extraction failed')
    );

    const activity: Activity = {
      type: 'message',
      id: 'test-error',
      conversation: { id: 'conv-error' },
      from: { id: 'user-error', name: 'Test User' },
      recipient: { id: 'bot-error', name: 'Test Bot' },
      text: JSON.stringify({ meetingTitle: 'Test', meetingTranscript: 'Test', approve: false }),
    };

    const response = await handler.handleActivity(activity);

    expect(response.type).toBe('message');
    expect(response.text).toContain('Error:');
  });
});
