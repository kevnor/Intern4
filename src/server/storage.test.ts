import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IMAGE_BUCKET,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_SOURCE_BYTES,
  clearSignedUrlCache,
  createSignedImageUrls,
  getSignedImageUrlMap,
  createImagePath,
  deleteImages,
  deleteImagesBestEffort,
  uploadImages,
  validateImageFile,
} from './storage';

const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlsMock = vi.fn();
const fromMock = vi.fn((bucket: string) => {
  void bucket;
  return {
    upload: uploadMock,
    remove: removeMock,
    createSignedUrls: createSignedUrlsMock,
  };
});

vi.mock('./supabaseClient', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => fromMock(bucket),
    },
  },
}));

describe('storage image helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSignedUrlCache();
    uploadMock.mockResolvedValue({ data: { path: 'path' }, error: null });
    removeMock.mockResolvedValue({ data: [], error: null });
    createSignedUrlsMock.mockResolvedValue({ data: [], error: null });
  });

  it('validates image mime type and size', () => {
    expect(() =>
      validateImageFile(new File(['x'], 'image.png', { type: 'image/png' }))
    ).not.toThrow();
    expect(() => validateImageFile(new File(['x'], 'text.txt', { type: 'text/plain' }))).toThrow(
      'text.txt er ikke et bilde.'
    );

    const largeFile = new File([new Uint8Array(IMAGE_MAX_SOURCE_BYTES + 1)], 'large.png', {
      type: 'image/png',
    });
    expect(() => validateImageFile(largeFile)).toThrow('large.png er større enn 20 MB.');
  });

  it('creates safe user-scoped paths', () => {
    const path = createImagePath('user-1', 'Regi bilder', new File(['x'], 'Min Fil!.PNG'));

    expect(path).toMatch(/^user-1\/regi-bilder\/.+-min-fil\.png$/);
  });

  it('uploads images to the configured bucket and cleans up earlier uploads on failure', async () => {
    uploadMock
      .mockResolvedValueOnce({ data: { path: 'one' }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('upload failed') });

    await expect(
      uploadImages('user-1', 'regi', [
        new File(['one'], 'one.png', { type: 'image/png' }),
        new File(['two'], 'two.png', { type: 'image/png' }),
      ])
    ).rejects.toThrow('upload failed');

    expect(fromMock).toHaveBeenCalledWith(IMAGE_BUCKET);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid files before uploading anything', async () => {
    await expect(
      uploadImages('user-1', 'regi', [
        new File(['one'], 'one.png', { type: 'image/png' }),
        new File(['two'], 'notes.txt', { type: 'text/plain' }),
      ])
    ).rejects.toThrow('notes.txt er ikke et bilde.');

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects images that are still too large after shrinking', async () => {
    // jsdom can't decode images, so the file is uploaded as-is and must fit the limit.
    await expect(
      uploadImages('user-1', 'regi', [
        new File([new Uint8Array(IMAGE_MAX_BYTES + 1)], 'huge.png', { type: 'image/png' }),
      ])
    ).rejects.toThrow('huge.png er for stort');

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('reuses signed URLs until they are about to expire', async () => {
    createSignedUrlsMock.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `signed:${path}` })),
      error: null,
    }));

    await expect(createSignedImageUrls(['a', 'b'])).resolves.toEqual(['signed:a', 'signed:b']);
    await expect(getSignedImageUrlMap(['b', 'c'])).resolves.toEqual({
      b: 'signed:b',
      c: 'signed:c',
    });

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(2);
    expect(createSignedUrlsMock).toHaveBeenLastCalledWith(['c'], 3600);
  });

  it('leaves out paths that could not be signed', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [
        { path: 'gone', signedUrl: null, error: 'Object not found' },
        { path: 'ok', signedUrl: 'signed:ok' },
      ],
      error: null,
    });

    await expect(getSignedImageUrlMap(['gone', 'ok'])).resolves.toEqual({ ok: 'signed:ok' });
  });

  it('throws when deleting images fails', async () => {
    removeMock.mockResolvedValueOnce({ data: null, error: new Error('delete failed') });

    await expect(deleteImages(['user/regi/one.png'])).rejects.toThrow('delete failed');
  });

  it('keeps best-effort deletion non-blocking', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    removeMock.mockResolvedValueOnce({ data: null, error: new Error('delete failed') });

    await expect(deleteImagesBestEffort(['user/regi/one.png'])).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
