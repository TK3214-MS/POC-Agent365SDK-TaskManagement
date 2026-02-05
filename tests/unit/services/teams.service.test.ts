import { describe, it, expect } from 'vitest';
import { formatTeamsMessage } from '@/services/graph/teams.service';

describe('Teams Service', () => {
  describe('formatTeamsMessage', () => {
    it('should format Teams message with counts', () => {
      const message = formatTeamsMessage('Q1 Planning', 3, 5, 2);

      expect(message).toContain('Meeting Summary: Q1 Planning');
      expect(message).toContain('Decisions:</strong> 3');
      expect(message).toContain('Action Items:</strong> 5');
       expect(message).toContain('Risks:</strong> 2');
      expect(message).toContain('External Agent');
    });

    it('should handle zero counts', () => {
      const message = formatTeamsMessage('Quick Sync', 0, 0, 0);

      expect(message).toContain('Decisions:</strong> 0');
      expect(message).toContain('Action Items:</strong> 0');
      expect(message).toContain('Risks:</strong> 0');
    });
  });
});
