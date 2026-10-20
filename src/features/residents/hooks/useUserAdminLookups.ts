import { useEffect, useState } from 'react';
import { getRoles, getSchools, getStudies } from '../../../server/dao/userDAO';
import { Role } from '../../../shared/types/user';
import { LookupOption } from '../../../shared/types/lookup';

// Roles, schools and studies for the create and edit forms; only loaded for managers.
export const useUserAdminLookups = (enabled: boolean) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [schools, setSchools] = useState<LookupOption[]>([]);
  const [studies, setStudies] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    Promise.all([getRoles(), getSchools(), getStudies()])
      .then(([roleOptions, schoolOptions, studyOptions]) => {
        if (!current) return;
        setRoles(roleOptions);
        setSchools(schoolOptions);
        setStudies(studyOptions);
      })
      .catch((error) => console.error('Kunne ikke laste roller og studier', error))
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [enabled]);

  return { roles, schools, studies, loading };
};
