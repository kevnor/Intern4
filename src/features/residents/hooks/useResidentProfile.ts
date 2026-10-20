import { useCallback, useEffect, useState } from 'react';
import { getUser } from '../../../server/dao/userDAO';
import { getRegiLogsByUser } from '../../../server/dao/regiDAO';
import { createSignedImageUrl } from '../../../server/storage';
import { User } from '../../../shared/types/user';
import { RegiLogWithId } from '../../../shared/types/regi';

export type ResidentProfile = User & { id: string };

// One resident's profile; regi entries are only loaded for managers.
export const useResidentProfile = (id: string, includeRegi: boolean) => {
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<RegiLogWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [user, regiLogs] = await Promise.all([
        getUser(id),
        includeRegi ? getRegiLogsByUser(id) : Promise.resolve([]),
      ]);
      if (!user) {
        setNotFound(true);
        return;
      }
      setNotFound(false);
      setProfile({ ...user, id });
      setLogs(regiLogs);
      setPhotoUrl(await createSignedImageUrl(user.profilePicture).catch(() => null));
    } catch (loadError) {
      console.error(loadError);
      setError('Kunne ikke laste beboeren.');
    } finally {
      setLoading(false);
    }
  }, [id, includeRegi]);

  useEffect(() => {
    void load();
  }, [load]);

  return { profile, photoUrl, logs, loading, notFound, error, reload: load };
};
