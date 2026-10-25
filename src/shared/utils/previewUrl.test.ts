import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreviewUrl, isBlobUrl } from './previewUrl';

const file = new Blob(['x'], { type: 'image/png' });

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('isBlobUrl', () => {
  it('accepts only blob addresses', () => {
    expect(isBlobUrl('blob:http://localhost:5173/4b0f-1')).toBe(true);
    expect(isBlobUrl('BLOB:http://localhost/x')).toBe(true);
    for (const value of ['', 'javascript:alert(1)', 'data:text/html,x', 'https://x.test/a.png']) {
      expect(isBlobUrl(value), value).toBe(false);
    }
  });
});

describe('createPreviewUrl', () => {
  it('returns the address the browser makes for the file', () => {
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/abc');

    expect(createPreviewUrl(file)).toBe('blob:http://localhost/abc');
  });

  it('gives no address where the browser cannot make one', () => {
    expect(typeof URL.createObjectURL).not.toBe('function');

    expect(createPreviewUrl(file)).toBe('');
  });

  it('never passes on an address that is not a blob address, and lets it go', () => {
    URL.createObjectURL = vi.fn(() => 'javascript:alert(1)');
    URL.revokeObjectURL = vi.fn();

    expect(createPreviewUrl(file)).toBe('');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('javascript:alert(1)');
  });
});
