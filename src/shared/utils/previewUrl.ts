// A temporary address for showing a file the user picked, before it is uploaded. The browser makes it
// (`blob:...`) and it only points at that file in memory. Anything else, such as an environment
// without createObjectURL, gets no address, so the page shows the file name instead.
const BLOB_URL = /^blob:/i;

export const isBlobUrl = (value: string): boolean => BLOB_URL.test(value);

export const createPreviewUrl = (file: Blob): string => {
  if (typeof URL.createObjectURL !== 'function') return '';
  const url = URL.createObjectURL(file);
  if (isBlobUrl(url)) return url;
  URL.revokeObjectURL(url);
  return '';
};
