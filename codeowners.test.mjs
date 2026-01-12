import { describe, it, expect } from 'vitest';

import Codeowners from './codeowners.js';

const repos = new Codeowners();

describe('codeowners', () => {
  it('returns owners for file', () => {
    const owner = repos.getOwner(__filename);
    expect(owner).toEqual(['@beaugunderson']);
  });

  it('owners is a copy of internal data', () => {
    repos.getOwner(__filename).pop();

    const owner = repos.getOwner(__filename);
    expect(owner).toEqual(['@beaugunderson']);
  });
});
