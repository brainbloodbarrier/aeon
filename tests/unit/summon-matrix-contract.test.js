import { readFile } from 'fs/promises';
import { describe, it, expect } from '@jest/globals';

const summonMatrixPath = new URL('../../.claude/commands/summon-matrix.md', import.meta.url);

async function readCommand() {
  return readFile(summonMatrixPath, 'utf-8');
}

describe('summon-matrix command contract', () => {
  it('preserves the five-phase workflow', async () => {
    const source = await readCommand();

    expect(source).toContain('### Phase 1: Soul Loading');
    expect(source).toContain('### Phase 2: Memory Retrieval');
    expect(source).toContain('### Phase 3: Context Assembly');
    expect(source).toContain('### Phase 4: Response Generation');
    expect(source).toContain('### Phase 5: Memory Storage');
  });

  it('includes the minimum matrix steps', async () => {
    const source = await readCommand();

    expect(source).toContain('Get or create user');
    expect(source).toContain('Get persona ID');
    expect(source).toContain('Query relevant memories');
    expect(source).toContain('Get relationship context');
    expect(source).toContain('Update relationship');
  });

  it('does not use forbidden placeholder interpolation', async () => {
    const source = await readCommand();

    expect(source).not.toContain("'{persona}");
    expect(source).not.toContain("'{user_id}");
    expect(source).not.toContain("'{persona_id}");
    expect(source).not.toContain("'{conv_id}");
    expect(source).not.toContain("'{response}");
  });

  it('contains explicit validation instructions before SQL lookup', async () => {
    const source = await readCommand();

    expect(source).toMatch(/validate persona name/i);
    expect(source).toMatch(/directory traversal|null bytes|path separator/i);
    expect(source).toMatch(/never interpolate unsanitized user input/i);
  });

  it('does not persist into interactions without a conversation contract', async () => {
    const source = await readCommand();

    expect(source).not.toContain('INSERT INTO interactions');
  });
});
