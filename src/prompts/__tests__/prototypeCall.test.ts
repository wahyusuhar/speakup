/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

import { CALL_START_CUE, PROTOTYPE_SYSTEM_PROMPT } from '../prototypeCall';

const promptsMd = readFileSync(join(__dirname, '..', '..', '..', 'PROMPTS.md'), 'utf8').replace(/\r\n/g, '\n');

describe('prototypeCall prompt', () => {
  it('has no unfilled placeholders and stays under the length budget', () => {
    expect(PROTOTYPE_SYSTEM_PROMPT).not.toMatch(/\{\{.*\}\}/);
    expect(PROTOTYPE_SYSTEM_PROMPT.length).toBeLessThan(6000);
  });

  it('is in sync with PROMPTS.md', () => {
    expect(promptsMd).toContain(PROTOTYPE_SYSTEM_PROMPT);
    expect(promptsMd).toContain(CALL_START_CUE);
  });
});
