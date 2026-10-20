import React, { useEffect, useState } from 'react';
import { createSignedImageUrls } from '../../server/storage';

type ImagePreviewGridProps = {
  paths?: string[];
  title?: string;
};

export const ImagePreviewGrid: React.FC<ImagePreviewGridProps> = ({ paths = [], title }) => {
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (paths.length === 0) {
      return;
    }

    createSignedImageUrls(paths)
      .then((signedUrls) => {
        if (!mounted) return;
        setUrls(signedUrls);
        setError(null);
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!mounted) return;
        setError('Kunne ikke laste bilder.');
      });

    return () => {
      mounted = false;
    };
  }, [paths]);

  if (paths.length === 0) return null;

  return (
    <div className="space-y-2">
      {title && <div className="text-sm font-medium text-fg">{title}</div>}
      {error ? (
        <div className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger-subtle-fg">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {urls.map((url, index) => (
            <a
              key={`${url}-${index}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl border border-border bg-surface-muted"
            >
              <img
                src={url}
                alt={`Opplastet bilde ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="h-28 w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
