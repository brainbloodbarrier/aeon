import { readFile } from 'fs/promises';
import { describe, it, expect } from '@jest/globals';

const serverPath = new URL('../../server.js', import.meta.url);
const assemblerPath = new URL('../../compute/context-assembler.js', import.meta.url);

async function read(pathUrl) {
  return readFile(pathUrl, 'utf-8');
}

describe('Invocation contract fixtures (Surface A)', () => {
  it('keeps the API invoke route wired to assembleContext metadata', async () => {
    const serverSource = await read(serverPath);

    expect(serverSource).toContain("const assembled = await assembleContext({");
    expect(serverSource).toContain("const fullSystem = personaMd + '\\n\\n' + assembled.systemPrompt;");
    expect(serverSource).toContain('metadata: assembled.metadata');
    expect(serverSource).toContain('sessionId: sid');
  });

  it('keeps assembleContext return shape stable', async () => {
    const source = await read(assemblerPath);

    expect(source).toContain('return {');
    expect(source).toContain('systemPrompt,');
    expect(source).toContain('components,');
    expect(source).toContain('metadata: {');
    expect(source).toContain('sessionId,');
    expect(source).toContain('totalTokens,');
    expect(source).toContain('truncated,');
    expect(source).toContain('memoriesIncluded: memoryObjects.length,');
  });

  it('keeps the frozen prompt assembly order comment and sequence', async () => {
    const source = await read(assemblerPath);

    const orderedMarkers = [
      '// Setting layer (atmosphere foundation)',
      '// Ambient layer (sensory details)',
      '// Temporal layer (time awareness)',
      '// Relationship layer (user context)',
      '// Persona relations layer',
      '// Memory layers (elect memories)',
      '// Preterite layer (surfacing forgotten)',
      '// Entropy layer (decay effects)',
      '// Drift correction layer',
      '// Zone resistance layer (meta-deflection)',
      '// Phase 2: "They" awareness layer (paranoid undertones)',
      '// Phase 2: Counterforce layer (resistance/collaboration tendency)',
      '// Phase 2: Narrative gravity layer (arc phase effects)',
      '// Phase 2: Interface bleed layer (system artifacts, highest priority for immersion-breaking)'
    ];

    let lastIndex = -1;
    for (const marker of orderedMarkers) {
      const index = source.indexOf(marker);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('documents the facade boundary in source imports', async () => {
    const serverSource = await read(serverPath);
    expect(serverSource).toContain("import { assembleContext, completeSession } from './compute/context-assembler.js';");
  });
});
