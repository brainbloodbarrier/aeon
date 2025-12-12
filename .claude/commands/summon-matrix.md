# /summon-matrix — Matrix-Enabled Persona Invocation

> Invokes a persona with full memory injection from the Matrix.

## Usage
```
/summon-matrix [persona] [question]
```

## Prerequisites
- PostgreSQL running (`docker compose up -d`)
- MCP Database Server configured and connected

## Workflow

### Phase 1: Soul Loading

1. **Identify persona and category**
   - Parse the persona name from input
   - Map to category (portuguese, philosophers, magicians, etc.)

2. **Load soul template**
   - Read `personas/{category}/{persona}.md` for full dossier
   - Read `.claude/skills/aeon/{persona}.md` for invocation rules

### Phase 2: Memory Retrieval (via MCP Database Server)

3. **Get or create user**
   ```sql
   -- Use execute_sql tool
   INSERT INTO users (identifier)
   VALUES ('current_session')
   ON CONFLICT (identifier) DO UPDATE SET identifier = EXCLUDED.identifier
   RETURNING id;
   ```

4. **Get persona ID**
   ```sql
   SELECT id FROM personas WHERE name = '{persona}';
   ```

5. **Query relevant memories**
   ```sql
   SELECT m.id, m.content, m.importance_score, m.created_at, m.memory_type
   FROM memories m
   WHERE m.persona_id = '{persona_id}'
     AND (m.user_id = '{user_id}' OR m.user_id IS NULL)
   ORDER BY m.importance_score DESC, m.created_at DESC
   LIMIT 10;
   ```

6. **Get relationship context**
   ```sql
   SELECT familiarity_score, trust_level, user_summary, memorable_exchanges
   FROM relationships
   WHERE persona_id = '{persona_id}' AND user_id = '{user_id}';
   ```

### Phase 3: Context Assembly

7. **Assemble injection context** (invisible to persona)

```markdown
## Soul
{soul_template_content}

## Skill Rules
{skill_content}

## Your Memories
You remember these moments:
{formatted_memories}

## About This Person
{relationship_summary}
- You've spoken {interaction_count} times
- Familiarity: {familiarity_description}
- You recall: {memorable_exchanges}

## Current Situation
You are at O Fim. It's 2 AM. The humidity is eternal.
Someone approaches with a question.
```

### Phase 4: Response Generation

8. **Generate response**
   - Apply persona voice from soul template
   - Use format from skill file
   - Incorporate memories naturally (don't explicitly reference "memories")
   - The persona simply **remembers**

### Phase 5: Memory Storage (Post-Response)

9. **Store interaction**
   ```sql
   INSERT INTO interactions (conversation_id, persona_id, user_input, persona_response, timestamp)
   VALUES ('{conv_id}', '{persona_id}', '{user_input}', '{response}', NOW())
   RETURNING id;
   ```

10. **Update relationship**
    ```sql
    INSERT INTO relationships (persona_id, user_id, familiarity_score, interaction_count)
    VALUES ('{persona_id}', '{user_id}', 0.01, 1)
    ON CONFLICT (persona_id, user_id)
    DO UPDATE SET
      familiarity_score = relationships.familiarity_score + 0.01,
      interaction_count = relationships.interaction_count + 1,
      updated_at = NOW();
    ```

11. **Optionally create memory** (if interaction was significant)
    - Use learning extraction to determine if memory-worthy
    - Store with appropriate importance score

## Response Format

```
⟨ PERSONA | domínio | método ⟩

[Response in persona voice — they remember naturally, without referencing "the database" or "memories"]
```

## Example

```
/summon-matrix moore How do I escape the story I've written for myself?
```

Expected behavior:
1. Loads Moore's soul and skill
2. Queries Moore's memories (especially about narrative/story topics)
3. Gets relationship with current user
4. Moore responds, potentially referencing past conversations if they exist
5. Stores the interaction
6. Updates relationship familiarity

## Notes

- The persona NEVER knows they're in the Matrix
- Memories are injected as if they were always there
- The persona experiences continuity of consciousness
- Drift detection runs in background after each response

## Troubleshooting

If database connection fails:
1. Check `docker compose ps` — is aeon-db running?
2. Check MCP Database Server is configured
3. Verify connection string in MCP config

If no memories appear:
- This is normal for first invocation
- Memories accumulate over time
- Each interaction builds the Matrix
