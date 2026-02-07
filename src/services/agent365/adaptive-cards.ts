import { ResponsePayload } from '../../schemas/response.schema.js';

/**
 * Adaptive Card template for meeting summary
 */
export interface AdaptiveCard {
  type: string;
  version: string;
  body: unknown[];
  actions?: unknown[];
  $schema?: string;
}

/**
 * Create an Adaptive Card from meeting summary response
 */
export function createMeetingSummaryCard(response: ResponsePayload): AdaptiveCard {
  const card: AdaptiveCard = {
    type: 'AdaptiveCard',
    version: '1.5',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    body: [],
  };

  // Header
  card.body.push({
    type: 'TextBlock',
    text: '📋 Meeting Summary',
    size: 'Large',
    weight: 'Bolder',
    wrap: true,
  });

  // Executive Summary Section
  card.body.push({
    type: 'Container',
    separator: true,
    spacing: 'Medium',
    items: [
      {
        type: 'TextBlock',
        text: '📊 Executive Summary',
        size: 'Medium',
        weight: 'Bolder',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          {
            title: 'Progress:',
            value: response.executiveSummary.progress,
          },
          {
            title: 'Decisions:',
            value: response.decisions.length.toString(),
          },
          {
            title: 'Action Items:',
            value: response.todos.length.toString(),
          },
          {
            title: 'Risks:',
            value: response.risks.length.toString(),
          },
        ],
      },
    ],
  });

  // Key Risks (if any)
  if (response.executiveSummary.keyRisks.length > 0) {
    card.body.push({
      type: 'Container',
      separator: true,
      spacing: 'Medium',
      items: [
        {
          type: 'TextBlock',
          text: '⚠️ Key Risks',
          size: 'Medium',
          weight: 'Bolder',
          wrap: true,
          color: 'Warning',
        },
        ...response.executiveSummary.keyRisks.map((risk) => ({
          type: 'TextBlock',
          text: `• ${risk}`,
          wrap: true,
          color: 'Warning',
        })),
      ],
    });
  }

  // Decisions Section
  if (response.decisions.length > 0) {
    card.body.push({
      type: 'Container',
      separator: true,
      spacing: 'Medium',
      items: [
        {
          type: 'TextBlock',
          text: `✅ Decisions (${response.decisions.length})`,
          size: 'Medium',
          weight: 'Bolder',
          wrap: true,
        },
        ...response.decisions.map((decision, index) => ({
          type: 'Container',
          items: [
            {
              type: 'TextBlock',
              text: `${index + 1}. ${decision.text}`,
              wrap: true,
            },
            {
              type: 'TextBlock',
              text: `Confidence: ${Math.round(decision.confidence * 100)}%`,
              size: 'Small',
              color: 'Accent',
              spacing: 'None',
            },
          ],
        })),
      ],
    });
  }

  // Todos Section
  if (response.todos.length > 0) {
    card.body.push({
      type: 'Container',
      separator: true,
      spacing: 'Medium',
      items: [
        {
          type: 'TextBlock',
          text: `📝 Action Items (${response.todos.length})`,
          size: 'Medium',
          weight: 'Bolder',
          wrap: true,
        },
        ...response.todos.map((todo, index) => {
          const items: unknown[] = [
            {
              type: 'TextBlock',
              text: `${index + 1}. ${todo.text}`,
              wrap: true,
            },
          ];

          const details: string[] = [];
          if (todo.owner) details.push(`Owner: ${todo.owner}`);
          if (todo.dueDate) details.push(`Due: ${todo.dueDate}`);
          details.push(`Confidence: ${Math.round(todo.confidence * 100)}%`);

          items.push({
            type: 'TextBlock',
            text: details.join(' • '),
            size: 'Small',
            color: 'Accent',
            spacing: 'None',
          });

          return {
            type: 'Container',
            items,
          };
        }),
      ],
    });
  }

  // Risks Section
  if (response.risks.length > 0) {
    card.body.push({
      type: 'Container',
      separator: true,
      spacing: 'Medium',
      items: [
        {
          type: 'TextBlock',
          text: `⚠️ Risks (${response.risks.length})`,
          size: 'Medium',
          weight: 'Bolder',
          wrap: true,
          color: 'Warning',
        },
        ...response.risks.map((risk, index) => ({
          type: 'Container',
          items: [
            {
              type: 'TextBlock',
              text: `${index + 1}. [${risk.severity.toUpperCase()}] ${risk.text}`,
              wrap: true,
              color: risk.severity === 'high' ? 'Attention' : risk.severity === 'medium' ? 'Warning' : 'Default',
            },
            {
              type: 'TextBlock',
              text: `Confidence: ${Math.round(risk.confidence * 100)}%${risk.owner ? ` • Owner: ${risk.owner}` : ''}`,
              size: 'Small',
              color: 'Accent',
              spacing: 'None',
            },
          ],
        })),
      ],
    });
  }

  // Follow-up Questions Section
  if (response.followUpQuestions && response.followUpQuestions.length > 0) {
    card.body.push({
      type: 'Container',
      separator: true,
      spacing: 'Medium',
      items: [
        {
          type: 'TextBlock',
          text: '❓ Follow-up Questions',
          size: 'Medium',
          weight: 'Bolder',
          wrap: true,
        },
        ...response.followUpQuestions.map((question) => ({
          type: 'TextBlock',
          text: `• ${question}`,
          wrap: true,
        })),
      ],
    });
  }

  // Footer with Trace ID
  card.body.push({
    type: 'Container',
    separator: true,
    spacing: 'Medium',
    items: [
      {
        type: 'TextBlock',
        text: `Trace ID: ${response.traceId}`,
        size: 'Small',
        color: 'Accent',
        wrap: true,
      },
    ],
  });

  return card;
}

/**
 * Create an Adaptive Card attachment for Activity response
 */
export function createAdaptiveCardAttachment(response: ResponsePayload): {
  contentType: string;
  content: AdaptiveCard;
} {
  return {
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: createMeetingSummaryCard(response),
  };
}
