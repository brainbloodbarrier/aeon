/**
 * AEON Matrix - Learning Extraction
 *
 * Extracts learnings from an interaction to update user patterns
 * and potentially create new memories.
 *
 * Run via Node.js Sandbox MCP: run_js_ephemeral
 *
 * Input (via environment):
 *   INTERACTION: JSON object with interaction data
 *     {
 *       user_input: string,
 *       persona_response: string,
 *       persona_name: string,
 *       quality_score: number (optional)
 *     }
 *   USER_HISTORY: JSON array of previous user inputs (optional)
 *
 * Output: JSON with extracted learnings
 */

const interaction = JSON.parse(process.env.INTERACTION || '{}');
const userHistory = JSON.parse(process.env.USER_HISTORY || '[]');

/**
 * Extract topic keywords from text.
 */
function extractTopics(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall',
    'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
    'until', 'while', 'although', 'i', 'me', 'my', 'you', 'your',
    'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who'
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));

  // Count frequency
  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Return top topics
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Analyze emotional tone of text.
 */
function analyzeTone(text) {
  const lowerText = text.toLowerCase();

  const toneIndicators = {
    curious: ['?', 'how', 'why', 'what', 'wonder', 'curious'],
    frustrated: ['frustrated', 'annoying', 'stuck', 'can\'t', 'impossible', 'hate'],
    seeking_advice: ['should', 'recommend', 'suggest', 'advice', 'help', 'best way'],
    philosophical: ['meaning', 'purpose', 'existence', 'truth', 'reality', 'nature of'],
    practical: ['how to', 'steps', 'process', 'method', 'technique', 'way to'],
    emotional: ['feel', 'feeling', 'emotion', 'sad', 'happy', 'anxious', 'worried']
  };

  const detected = [];
  for (const [tone, indicators] of Object.entries(toneIndicators)) {
    const matches = indicators.filter(i => lowerText.includes(i)).length;
    if (matches >= 2 || (matches >= 1 && indicators.length <= 3)) {
      detected.push(tone);
    }
  }

  return detected.length > 0 ? detected : ['neutral'];
}

/**
 * Analyze user interaction style.
 */
function analyzeStyle(text) {
  const style = {
    verbosity: text.length > 200 ? 'verbose' : text.length > 50 ? 'moderate' : 'brief',
    formality: /please|thank|would you|could you/i.test(text) ? 'formal' : 'casual',
    directness: text.includes('?') ? 'questioning' : 'declarative'
  };

  return style;
}

/**
 * Determine if this interaction should create a memory.
 */
function shouldRemember(interaction) {
  const { user_input, persona_response, quality_score } = interaction;

  // Quality threshold
  if (quality_score && quality_score > 0.7) return true;

  // Long, substantive responses
  if (persona_response.length > 500) return true;

  // Deep questions (philosophical, existential)
  const deepIndicators = ['meaning', 'purpose', 'why do', 'what is', 'nature of', 'truth'];
  if (deepIndicators.some(i => user_input.toLowerCase().includes(i))) return true;

  // Personal revelations
  const personalIndicators = ['my life', 'i feel', 'i\'m struggling', 'my problem'];
  if (personalIndicators.some(i => user_input.toLowerCase().includes(i))) return true;

  return false;
}

/**
 * Create a memory summary from interaction.
 */
function createMemorySummary(interaction) {
  const { user_input, persona_response, persona_name } = interaction;

  // Extract key points
  const topics = extractTopics(user_input + ' ' + persona_response);
  const userTopics = extractTopics(user_input);

  return {
    summary: `User asked about ${userTopics.slice(0, 3).join(', ')}. ${persona_name} responded with guidance on ${topics.slice(0, 3).join(', ')}.`,
    topics: topics,
    userQuery: user_input.substring(0, 200),
    responseHighlight: persona_response.substring(0, 300)
  };
}

/**
 * Detect recurring patterns in user history.
 */
function detectPatterns(history) {
  if (history.length < 3) return { recurring_topics: [], style_consistency: 'insufficient_data' };

  // Aggregate topics
  const allTopics = history.flatMap(h => extractTopics(h));
  const topicFreq = {};
  for (const topic of allTopics) {
    topicFreq[topic] = (topicFreq[topic] || 0) + 1;
  }

  // Topics that appear in >30% of interactions
  const threshold = history.length * 0.3;
  const recurringTopics = Object.entries(topicFreq)
    .filter(([, count]) => count >= threshold)
    .map(([topic]) => topic);

  return {
    recurring_topics: recurringTopics,
    interaction_count: history.length
  };
}

// Main extraction
const result = {
  // Current interaction analysis
  topics: extractTopics(interaction.user_input || ''),
  tone: analyzeTone(interaction.user_input || ''),
  style: analyzeStyle(interaction.user_input || ''),

  // Memory decision
  shouldRemember: shouldRemember(interaction),
  memorySummary: shouldRemember(interaction) ? createMemorySummary(interaction) : null,

  // Pattern detection (if history provided)
  patterns: detectPatterns(userHistory),

  // Suggested updates
  updates: {
    familiarity_increment: 0.01,
    topics_to_add: extractTopics(interaction.user_input || '')
  }
};

console.log(JSON.stringify(result, null, 2));
