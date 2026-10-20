import { useEffect, useMemo, useState } from 'react';
import { getSignedImageUrlMap } from '../../../server/storage';

type WithPicture = { id: string; profilePicture?: string | null };

// Signs all visible profile pictures in one request; returns id -> URL.
export const useProfilePictureUrls = (people: WithPicture[]): Record<string, string> => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const withPictures = useMemo(
    () =>
      people.filter(
        (person): person is { id: string; profilePicture: string } => !!person.profilePicture
      ),
    [people]
  );
  const key = withPictures.map((person) => `${person.id}:${person.profilePicture}`).join('|');

  useEffect(() => {
    if (withPictures.length === 0) return;
    let current = true;
    getSignedImageUrlMap(withPictures.map((person) => person.profilePicture))
      .then((signed) => {
        if (!current) return;
        setUrls(
          Object.fromEntries(
            withPictures
              .filter((person) => signed[person.profilePicture])
              .map((person) => [person.id, signed[person.profilePicture]])
          )
        );
      })
      .catch((error) => console.error('Kunne ikke laste profilbilder', error));
    return () => {
      current = false;
    };
    // `key` captures the people and paths; the array itself changes identity on every load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
};
