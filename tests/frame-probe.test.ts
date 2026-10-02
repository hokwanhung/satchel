import { describe, expect, it } from 'vitest';
import { shouldInjectFrame, shouldProbeMindMap } from '../lib/frame-probe';

describe('shouldInjectFrame', () => {
  it('matches blob, usercontent, and shim frames', () => {
    expect(shouldInjectFrame('blob:https://notebook.google.com/abc')).toBe(true);
    expect(shouldInjectFrame('https://abc.usercontent.goog/shim.html')).toBe(true);
    expect(shouldInjectFrame('https://example.com/')).toBe(false);
  });
});

describe('shouldProbeMindMap', () => {
  it('covers notebook hosts and studio frames', () => {
    expect(shouldProbeMindMap('https://notebook.google.com/notebook/abc')).toBe(true);
    expect(shouldProbeMindMap('https://notebooklm.google.com/')).toBe(true);
    expect(shouldProbeMindMap('blob:https://notebook.google.com/abc')).toBe(true);
    expect(shouldProbeMindMap('https://example.com/')).toBe(false);
  });
});
