/**
 * Unit tests for memory-extractor.js
 * Constitution Principle IV: Relationship Continuity
 */

import { jest } from '@jest/globals';

// ═══════════════════════════════════════════════════════════════════════════
// ESM Mock Setup — ALL mocks BEFORE any await import()
// ═══════════════════════════════════════════════════════════════════════════

const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  end: jest.fn()
};

jest.unstable_mockModule('../../compute/db-pool.js', () => ({
  getSharedPool: jest.fn(() => mockPool)
}));

jest.unstable_mockModule('../../compute/operator-logger.js', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined)
}));

// Import after mocking
const {
  analyzeForMemories,
  calculateImportance,
  classifyMemoryType,
  summarizeExchange,
  extractPatterns,
  extractSessionMemories,
  storeMemory,
  EXTRACTION_CONFIG,
  IMPORTANCE_WEIGHTS
} = await import('../../compute/memory-extractor.js');

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Memory Extractor Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Constants
  // ═════════════════════════════════════════════════════════════════════════

  describe('EXTRACTION_CONFIG', () => {
    it('should define extraction parameters', () => {
      expect(EXTRACTION_CONFIG.minMessages).toBe(3);
      expect(EXTRACTION_CONFIG.maxMemoriesPerSession).toBe(3);
      expect(EXTRACTION_CONFIG.memoryMaxLength).toBe(500);
      expect(EXTRACTION_CONFIG.importanceThreshold).toBe(0.3);
    });
  });

  describe('IMPORTANCE_WEIGHTS', () => {
    it('should define weight values that sum to 1.0', () => {
      const total = Object.values(IMPORTANCE_WEIGHTS).reduce((sum, w) => sum + w, 0);
      expect(total).toBeCloseTo(1.0);
    });

    it('should prioritize personal disclosure highest', () => {
      expect(IMPORTANCE_WEIGHTS.personalDisclosure).toBeGreaterThan(IMPORTANCE_WEIGHTS.questionDepth);
      expect(IMPORTANCE_WEIGHTS.questionDepth).toBeGreaterThan(IMPORTANCE_WEIGHTS.topicSignificance);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // classifyMemoryType — pure function
  // ═════════════════════════════════════════════════════════════════════════

  describe('classifyMemoryType', () => {
    it('should return insight when patterns include preference', () => {
      const result = classifyMemoryType('I always prefer dark themes', ['personal', 'preference']);
      expect(result).toBe('insight');
    });

    it('should return learning when patterns include fact', () => {
      const result = classifyMemoryType('I work at a university', ['personal', 'fact']);
      expect(result).toBe('learning');
    });

    it('should return interaction as default', () => {
      const result = classifyMemoryType('Tell me about dialectics', ['depth']);
      expect(result).toBe('interaction');
    });

    it('should prioritize preference over fact', () => {
      // preference is checked first in the function
      const result = classifyMemoryType('I always work late', ['preference', 'fact']);
      expect(result).toBe('insight');
    });

    it('should return interaction for empty patterns', () => {
      const result = classifyMemoryType('Hello world', []);
      expect(result).toBe('interaction');
    });

    it('should return DB-compatible values (not episodic/semantic/procedural)', () => {
      const validTypes = ['interaction', 'learning', 'insight'];

      expect(validTypes).toContain(classifyMemoryType('test', []));
      expect(validTypes).toContain(classifyMemoryType('test', ['preference']));
      expect(validTypes).toContain(classifyMemoryType('test', ['fact']));
      expect(validTypes).toContain(classifyMemoryType('test', ['personal']));
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // calculateImportance — pure function
  // ═════════════════════════════════════════════════════════════════════════

  describe('calculateImportance', () => {
    it('should return 0 for empty patterns and no session data', () => {
      const result = calculateImportance([], null);
      expect(result).toBe(0);
    });

    it('should add personal disclosure weight', () => {
      const result = calculateImportance(['personal'], null);
      expect(result).toBe(IMPORTANCE_WEIGHTS.personalDisclosure);
    });

    it('should add question depth weight', () => {
      const result = calculateImportance(['depth'], null);
      expect(result).toBe(IMPORTANCE_WEIGHTS.questionDepth);
    });

    it('should add topic significance weight', () => {
      const result = calculateImportance(['significance'], null);
      expect(result).toBe(IMPORTANCE_WEIGHTS.topicSignificance);
    });

    it('should accumulate weights for multiple patterns', () => {
      const result = calculateImportance(['personal', 'depth'], null);
      expect(result).toBeCloseTo(
        IMPORTANCE_WEIGHTS.personalDisclosure + IMPORTANCE_WEIGHTS.questionDepth
      );
    });

    it('should add session length bonus for sessions > 5 minutes', () => {
      const sessionData = {
        startedAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        endedAt: Date.now()
      };
      const result = calculateImportance(['personal'], sessionData);
      expect(result).toBeCloseTo(
        IMPORTANCE_WEIGHTS.personalDisclosure + IMPORTANCE_WEIGHTS.sessionLength
      );
    });

    it('should NOT add session length bonus for sessions <= 5 minutes', () => {
      const sessionData = {
        startedAt: Date.now() - 3 * 60 * 1000, // 3 minutes ago
        endedAt: Date.now()
      };
      const result = calculateImportance(['personal'], sessionData);
      expect(result).toBeCloseTo(IMPORTANCE_WEIGHTS.personalDisclosure);
    });

    it('should cap importance at 1.0', () => {
      const sessionData = {
        startedAt: Date.now() - 30 * 60 * 1000,
        endedAt: Date.now()
      };
      // All possible patterns + session bonus
      const result = calculateImportance(
        ['personal', 'depth', 'significance'],
        sessionData
      );
      expect(result).toBeLessThanOrEqual(1.0);
      // 0.4 + 0.3 + 0.2 + 0.1 = 1.0 (floating-point: use toBeCloseTo)
      expect(result).toBeCloseTo(1.0);
    });

    it('should return value between 0 and 1', () => {
      const variations = [
        [[], null],
        [['personal'], null],
        [['personal', 'depth', 'significance'], null],
        [['depth'], { startedAt: Date.now() - 600000, endedAt: Date.now() }]
      ];
      for (const [patterns, session] of variations) {
        const result = calculateImportance(patterns, session);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      }
    });

    it('should not count unrecognized pattern types', () => {
      const result = calculateImportance(['preference', 'fact', 'unknown'], null);
      expect(result).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // analyzeForMemories — pure function
  // ═════════════════════════════════════════════════════════════════════════

  describe('analyzeForMemories', () => {
    it('should return empty array for empty messages', () => {
      const result = analyzeForMemories([]);
      expect(result).toEqual([]);
    });

    it('should only analyze user messages', () => {
      const messages = [
        { role: 'assistant', content: 'I think you should consider philosophy' },
        { role: 'system', content: 'You are a persona' }
      ];
      const result = analyzeForMemories(messages);
      expect(result).toEqual([]);
    });

    it('should detect personal disclosure patterns', () => {
      const messages = [
        { role: 'user', content: 'I am a software engineer working on distributed systems' }
      ];
      const result = analyzeForMemories(messages);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].patterns).toContain('personal');
    });

    it('should detect question depth patterns', () => {
      const messages = [
        { role: 'user', content: 'Can you explain how does that relate to the dialectic?' }
      ];
      const result = analyzeForMemories(messages);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].patterns).toContain('depth');
    });

    it('should detect topic significance patterns', () => {
      const messages = [
        { role: 'user', content: 'What is the existential meaning of dialectic synthesis?' }
      ];
      const result = analyzeForMemories(messages);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].patterns).toContain('significance');
    });

    it('should detect preference patterns', () => {
      const messages = [
        { role: 'user', content: 'I always prefer a more direct approach to philosophy' }
      ];
      const result = analyzeForMemories(messages);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].patterns).toContain('preference');
    });

    it('should detect fact patterns', () => {
      const messages = [
        { role: 'user', content: 'I work at MIT in the philosophy department' }
      ];
      const result = analyzeForMemories(messages);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].patterns).toContain('fact');
    });

    it('should ignore user messages with no detectable patterns', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'user', content: 'Thanks' }
      ];
      const result = analyzeForMemories(messages);
      expect(result).toEqual([]);
    });

    it('should include sourceIndex, content, patterns, and estimatedImportance', () => {
      const messages = [
        { role: 'assistant', content: 'Welcome.' },
        { role: 'user', content: 'I believe in the fundamental principle of dialectics' }
      ];
      const result = analyzeForMemories(messages);
      expect(result.length).toBe(1);
      expect(result[0].sourceIndex).toBe(1);
      expect(result[0].content).toBe(messages[1].content);
      expect(Array.isArray(result[0].patterns)).toBe(true);
      expect(typeof result[0].estimatedImportance).toBe('number');
    });

    it('should calculate estimatedImportance as patterns.length * 0.25', () => {
      const messages = [
        { role: 'user', content: 'I am interested in the existential meaning of philosophy' }
      ];
      const result = analyzeForMemories(messages);
      if (result.length > 0) {
        expect(result[0].estimatedImportance).toBeCloseTo(result[0].patterns.length * 0.25);
      }
    });

    it('should handle mixed role messages correctly', () => {
      const messages = [
        { role: 'user', content: 'I feel that philosophy is fundamental' },
        { role: 'assistant', content: 'Indeed, the dialectic reveals...' },
        { role: 'user', content: 'Can you explain more about synthesis?' },
        { role: 'assistant', content: 'Synthesis is the Aufhebung...' }
      ];
      const result = analyzeForMemories(messages);
      // Should only have candidates from user messages (indices 0 and 2)
      for (const candidate of result) {
        expect(messages[candidate.sourceIndex].role).toBe('user');
      }
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // summarizeExchange — pure function
  // ═════════════════════════════════════════════════════════════════════════

  describe('summarizeExchange', () => {
    it('should produce a third-person summary for work-related content', () => {
      const messages = [
        { role: 'user', content: 'I work as a software architect at a startup.' },
        { role: 'assistant', content: 'Interesting work.' }
      ];
      const summary = summarizeExchange(messages, 0, 1);
      expect(summary).toContain('They');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should detect interest/like statements', () => {
      const messages = [
        { role: 'user', content: 'I love reading about existential philosophy and Nietzsche.' }
      ];
      const summary = summarizeExchange(messages, 0, 0);
      expect(summary).toContain('interested in');
    });

    it('should fall back to generic summary when no specific match', () => {
      const messages = [
        { role: 'user', content: 'Tell me something about the nature of consciousness and reality beyond perception.' }
      ];
      const summary = summarizeExchange(messages, 0, 0);
      // Generic fallback either starts with "They discussed:" or "Exchange about"
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should respect memoryMaxLength character limit', () => {
      const longContent = 'I work as a ' + 'very '.repeat(200) + 'important person.';
      const messages = [
        { role: 'user', content: longContent }
      ];
      const summary = summarizeExchange(messages, 0, 0);
      expect(summary.length).toBeLessThanOrEqual(EXTRACTION_CONFIG.memoryMaxLength);
    });

    it('should handle single message exchange', () => {
      const messages = [
        { role: 'user', content: 'I am a teacher who loves philosophy fundamentally.' }
      ];
      const summary = summarizeExchange(messages, 0, 0);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should only use user messages for summary content', () => {
      const messages = [
        { role: 'assistant', content: 'As an AI, I am happy to help you.' },
        { role: 'user', content: 'I work as a data scientist.' },
        { role: 'assistant', content: 'Fascinating field.' }
      ];
      const summary = summarizeExchange(messages, 0, 2);
      // Should reference user content, not assistant content
      expect(summary).not.toContain('As an AI');
    });

    it('should handle endIndex beyond messages length gracefully', () => {
      const messages = [
        { role: 'user', content: 'I love the concept of synthesis in dialectics.' }
      ];
      // endIndex = 5 but only 1 message — slice handles this safely
      const summary = summarizeExchange(messages, 0, 5);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // extractPatterns — pure function
  // ═════════════════════════════════════════════════════════════════════════

  describe('extractPatterns', () => {
    it('should extract topics from word frequency', () => {
      const sessionData = {
        messages: [
          { role: 'user', content: 'Philosophy is about understanding philosophy deeply through philosophy.' },
          { role: 'user', content: 'Understanding comes through reflection and understanding.' }
        ]
      };
      const result = extractPatterns(sessionData);
      expect(result.topics).toContain('philosophy');
      expect(result.topics.length).toBeLessThanOrEqual(5);
    });

    it('should only count words longer than 4 characters', () => {
      const sessionData = {
        messages: [
          { role: 'user', content: 'the the the and and or but not yes' }
        ]
      };
      const result = extractPatterns(sessionData);
      // All words <= 4 chars, so no topics
      expect(result.topics).toEqual([]);
    });

    it('should only analyze user messages', () => {
      const sessionData = {
        messages: [
          { role: 'assistant', content: 'Philosophy philosophy philosophy philosophy philosophy' },
          { role: 'user', content: 'Hello there' }
        ]
      };
      const result = extractPatterns(sessionData);
      // 'philosophy' only appears in assistant message, should not be in topics
      expect(result.topics).not.toContain('philosophy');
    });

    it('should classify verbosity as concise for short messages', () => {
      const sessionData = {
        messages: [
          { role: 'user', content: 'Short message.' },
          { role: 'user', content: 'Another short one.' }
        ]
      };
      const result = extractPatterns(sessionData);
      expect(result.style.verbosity).toBe('concise');
    });

    it('should classify verbosity as moderate for medium messages', () => {
      const mediumContent = 'This is a moderately long message that contains enough words to push the average length above fifty characters but not above two hundred characters.';
      const sessionData = {
        messages: [
          { role: 'user', content: mediumContent }
        ]
      };
      const result = extractPatterns(sessionData);
      expect(result.style.verbosity).toBe('moderate');
    });

    it('should classify verbosity as verbose for long messages', () => {
      const longContent = 'A'.repeat(250);
      const sessionData = {
        messages: [
          { role: 'user', content: longContent }
        ]
      };
      const result = extractPatterns(sessionData);
      expect(result.style.verbosity).toBe('verbose');
    });

    it('should calculate question ratio correctly', () => {
      const sessionData = {
        messages: [
          { role: 'user', content: 'What is philosophy?' },
          { role: 'user', content: 'Tell me more.' },
          { role: 'user', content: 'Why is that important?' },
          { role: 'user', content: 'Interesting thought.' }
        ]
      };
      const result = extractPatterns(sessionData);
      // 2 out of 4 messages contain '?'
      expect(result.style.questionRatio).toBeCloseTo(0.5);
    });

    it('should handle empty messages array', () => {
      const result = extractPatterns({ messages: [] });
      expect(result.topics).toEqual([]);
      expect(result.style.verbosity).toBe('concise');
      expect(result.style.questionRatio).toBe(0);
    });

    it('should handle missing messages property', () => {
      const result = extractPatterns({});
      expect(result.topics).toEqual([]);
      expect(result.style).toBeDefined();
    });

    it('should include updatedAt timestamp', () => {
      const result = extractPatterns({ messages: [] });
      expect(result.updatedAt).toBeDefined();
      // Should be a valid ISO date string
      expect(() => new Date(result.updatedAt)).not.toThrow();
    });

    it('should return top 5 topics maximum', () => {
      // Generate content with many repeated words
      const words = ['architecture', 'dialectics', 'philosophy', 'synthesis',
                     'understanding', 'consciousness', 'metaphysics', 'epistemology'];
      const content = words.map(w => `${w} ${w} ${w}`).join(' ');
      const sessionData = {
        messages: [{ role: 'user', content }]
      };
      const result = extractPatterns(sessionData);
      expect(result.topics.length).toBeLessThanOrEqual(5);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // extractSessionMemories — integration (uses pure functions + logging)
  // ═════════════════════════════════════════════════════════════════════════

  describe('extractSessionMemories', () => {
    it('should return empty array for too few messages', async () => {
      const result = await extractSessionMemories({
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' }
        ],
        sessionId: 's1',
        userId: 'u1',
        personaId: 'p1'
      });
      expect(result).toEqual([]);
    });

    it('should extract memories from session with memorable content', async () => {
      const result = await extractSessionMemories({
        messages: [
          { role: 'user', content: 'I am a philosopher who believes in existential meaning.' },
          { role: 'assistant', content: 'The dialectic reveals...' },
          { role: 'user', content: 'I always prefer direct answers about philosophy.' },
          { role: 'assistant', content: 'Directness is a virtue...' },
          { role: 'user', content: 'Can you explain how does that synthesis work specifically?' }
        ],
        sessionId: 'session-1',
        userId: 'user-1',
        personaId: 'hegel',
        startedAt: Date.now() - 600000,
        endedAt: Date.now()
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(EXTRACTION_CONFIG.maxMemoriesPerSession);

      for (const memory of result) {
        expect(memory).toHaveProperty('content');
        expect(memory).toHaveProperty('memoryType');
        expect(memory).toHaveProperty('importance');
        expect(memory).toHaveProperty('extractedFrom', 'session-1');
        expect(['interaction', 'learning', 'insight']).toContain(memory.memoryType);
      }
    });

    it('should return empty array when no patterns detected', async () => {
      const result = await extractSessionMemories({
        messages: [
          { role: 'user', content: 'ok' },
          { role: 'assistant', content: 'ok' },
          { role: 'user', content: 'sure' },
          { role: 'assistant', content: 'fine' }
        ],
        sessionId: 's1'
      });
      expect(result).toEqual([]);
    });

    it('should filter by importance threshold', async () => {
      const result = await extractSessionMemories({
        messages: [
          { role: 'user', content: 'Hello there today' },
          { role: 'assistant', content: 'Hello' },
          { role: 'user', content: 'I feel sad today about things' },
          { role: 'assistant', content: 'I understand' },
          { role: 'user', content: 'Goodbye now then' }
        ],
        sessionId: 's1',
        startedAt: Date.now() - 60000, // only 1 minute session (no bonus)
        endedAt: Date.now()
      });

      // All returned memories should meet the importance threshold
      for (const memory of result) {
        expect(memory.importance).toBeGreaterThanOrEqual(EXTRACTION_CONFIG.importanceThreshold);
      }
    });

    it('should cap at maxMemoriesPerSession', async () => {
      // Create many memorable messages
      const messages = [];
      for (let i = 0; i < 20; i++) {
        messages.push({
          role: 'user',
          content: `I believe in the fundamental principle of existential philosophy number ${i}. Can you explain more about this specific topic?`
        });
        messages.push({
          role: 'assistant',
          content: `Indeed, the dialectic reveals truth ${i}.`
        });
      }

      const result = await extractSessionMemories({
        messages,
        sessionId: 's1',
        startedAt: Date.now() - 600000,
        endedAt: Date.now()
      });

      expect(result.length).toBeLessThanOrEqual(EXTRACTION_CONFIG.maxMemoriesPerSession);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // storeMemory — DB-dependent
  // ═════════════════════════════════════════════════════════════════════════

  describe('storeMemory', () => {
    it('should store memory and return ID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'memory-uuid-123' }]
      });

      const result = await storeMemory('user-1', 'persona-1', {
        content: 'They work as a software architect.',
        memoryType: 'learning',
        importance: 0.7
      });

      expect(result).toBe('memory-uuid-123');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO memories'),
        ['user-1', 'persona-1', 'They work as a software architect.', 'learning', 0.7]
      );
    });

    it('should return null on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('duplicate key'));

      const result = await storeMemory('user-1', 'persona-1', {
        content: 'Test',
        memoryType: 'interaction',
        importance: 0.5
      });

      expect(result).toBeNull();
    });
  });
});
