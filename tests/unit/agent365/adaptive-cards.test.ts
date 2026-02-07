import { describe, it, expect } from 'vitest';
import { createMeetingSummaryCard, createAdaptiveCardAttachment } from '../../../src/services/agent365/adaptive-cards.js';
import { ResponsePayload } from '../../../src/schemas/response.schema.js';

describe('Adaptive Cards', () => {
  const mockResponse: ResponsePayload = {
    executiveSummary: {
      progress: 'Good progress on Q1 planning',
      keyRisks: ['Budget constraints', 'Resource availability'],
      decisionsNeeded: ['Approve timeline'],
    },
    decisions: [
      {
        text: 'Approve Q1 roadmap',
        confidence: 0.92,
      },
    ],
    todos: [
      {
        text: 'Update timeline',
        owner: 'Bob',
        dueDate: '2026-02-12',
        confidence: 0.88,
      },
      {
        text: 'Review budget',
        owner: 'Alice',
        confidence: 0.85,
      },
    ],
    risks: [
      {
        text: 'Budget constraints',
        severity: 'high',
        confidence: 0.90,
      },
      {
        text: 'Schedule delays',
        severity: 'medium',
        owner: 'Charlie',
        confidence: 0.75,
      },
    ],
    followUpQuestions: ['When is the final deadline?', 'Who approves the budget?'],
    draftActions: [],
    traceId: 'test-trace-123',
  };

  describe('createMeetingSummaryCard', () => {
    it('should create valid Adaptive Card structure', () => {
      const card = createMeetingSummaryCard(mockResponse);

      expect(card.type).toBe('AdaptiveCard');
      expect(card.version).toBe('1.5');
      expect(card.$schema).toBe('http://adaptivecards.io/schemas/adaptive-card.json');
      expect(card.body).toBeDefined();
      expect(Array.isArray(card.body)).toBe(true);
    });

    it('should include header section', () => {
      const card = createMeetingSummaryCard(mockResponse);
      const header = card.body[0] as { type: string; text: string };

      expect(header.type).toBe('TextBlock');
      expect(header.text).toContain('Meeting Summary');
    });

    it('should include executive summary with facts', () => {
      const card = createMeetingSummaryCard(mockResponse);
      const summary = card.body[1] as { type: string; items: unknown[] };

      expect(summary.type).toBe('Container');
      expect(Array.isArray(summary.items)).toBe(true);

      const factSet = summary.items[1] as { type: string; facts: unknown[] };
      expect(factSet.type).toBe('FactSet');
      expect(Array.isArray(factSet.facts)).toBe(true);
      expect(factSet.facts.length).toBeGreaterThan(0);
    });

    it('should include key risks section when risks exist', () => {
      const card = createMeetingSummaryCard(mockResponse);
      const risksSection = card.body.find(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'items' in item &&
          Array.isArray(item.items) &&
          item.items.some(
            (subItem: unknown) =>
              typeof subItem === 'object' &&
              subItem !== null &&
              'text' in subItem &&
              typeof subItem.text === 'string' &&
              subItem.text.includes('Key Risks')
          )
      );

      expect(risksSection).toBeDefined();
    });

    it('should include decisions section', () => {
      const card = createMeetingSummaryCard(mockResponse);
      const decisionsSection = card.body.find(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'items' in item &&
          Array.isArray(item.items) &&
          item.items.some(
            (subItem: unknown) =>
              typeof subItem === 'object' &&
              subItem !== null &&
              'text' in subItem &&
              typeof subItem.text === 'string' &&
              subItem.text.includes('Decisions')
          )
      );

      expect(decisionsSection).toBeDefined();
    });

    it('should include todos section with owner and due date', () => {
      const card = createMeetingSummaryCard(mockResponse);
      const todosSection = card.body.find(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'items' in item &&
          Array.isArray(item.items) &&
          item.items.some(
            (subItem: unknown) =>
              typeof subItem === 'object' &&
              subItem !== null &&
              'text' in subItem &&
              typeof subItem.text === 'string' &&
              subItem.text.includes('Action Items')
          )
      );

      expect(todosSection).toBeDefined();
    });

    it('should include risks section with severity colors', () => {
      const card = createMeetingSummaryCard(mockResponse);
      const risksSection = card.body.find(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'items' in item &&
          Array.isArray(item.items) &&
          item.items.some(
            (subItem: unknown) =>
              typeof subItem === 'object' &&
              subItem !== null &&
              'text' in subItem &&
              typeof subItem.text === 'string' &&
              subItem.text.includes('Risks (')
          )
      );

      expect(risksSection).toBeDefined();
    });

    it('should include follow-up questions when present', () => {
      const card = createMeetingSummaryCard(mockResponse);
      const questionsSection = card.body.find(
        (item: unknown) =>
          typeof item === 'object' &&
          item !== null &&
          'items' in item &&
          Array.isArray(item.items) &&
          item.items.some(
            (subItem: unknown) =>
              typeof subItem === 'object' &&
              subItem !== null &&
              'text' in subItem &&
              typeof subItem.text === 'string' &&
              subItem.text.includes('Follow-up Questions')
          )
      );

      expect(questionsSection).toBeDefined();
    });

    it('should include trace ID in footer', () => {
      const card = createMeetingSummaryCard(mockResponse);
      const footer = card.body[card.body.length - 1] as { type: string; items: unknown[] };

      expect(footer.type).toBe('Container');
      const traceIdText = footer.items[0] as { type: string; text: string };
      expect(traceIdText.text).toContain('test-trace-123');
    });

    it('should handle empty sections gracefully', () => {
      const emptyResponse: ResponsePayload = {
        executiveSummary: {
          progress: 'No updates',
          keyRisks: [],
          decisionsNeeded: [],
        },
        decisions: [],
        todos: [],
        risks: [],
        followUpQuestions: [],
        draftActions: [],
        traceId: 'empty-trace',
      };

      const card = createMeetingSummaryCard(emptyResponse);

      expect(card.type).toBe('AdaptiveCard');
      expect(card.body).toBeDefined();
      expect(Array.isArray(card.body)).toBe(true);
    });
  });

  describe('createAdaptiveCardAttachment', () => {
    it('should create proper attachment structure', () => {
      const attachment = createAdaptiveCardAttachment(mockResponse);

      expect(attachment.contentType).toBe('application/vnd.microsoft.card.adaptive');
      expect(attachment.content).toBeDefined();
      expect(attachment.content.type).toBe('AdaptiveCard');
    });

    it('should include valid Adaptive Card in content', () => {
      const attachment = createAdaptiveCardAttachment(mockResponse);

      expect(attachment.content.version).toBe('1.5');
      expect(attachment.content.body).toBeDefined();
      expect(Array.isArray(attachment.content.body)).toBe(true);
    });
  });
});
