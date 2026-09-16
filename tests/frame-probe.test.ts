import { describe, expect, it } from 'vitest';
import { shouldInjectFrame } from '../lib/frame-probe';

describe('shouldInjectFrame', () => {
  it('matches blob, usercontent, and shim frames', () => {
    expect(shouldInjectFrame('blob:https://notebook.google.com/abc')).toBe(true);
    expect(shouldInjectFrame('https://abc.usercontent.goog/shim.html')).toBe(true);
    expect(shouldInjectFrame('https://example.com/')).toBe(false);
  });
});
