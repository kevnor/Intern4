import { useEffect, useState } from 'react';
import { getRoles, getSchools, getStudies } from '../../../server/dao/userDAO';
import { getRooms } from '../../../server/dao/roomsDAO';
import type { Room } from '../../rooms/types';
import { Role } from '../../../shared/types/user';
import { LookupOption } from '../../../shared/types/lookup';

// Roles, schools, studies and rooms for the create and edit forms; only loaded for managers.
export const useUserAdminLookups = (enabled: boolean) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [schools, setSchools] = useState<LookupOption[]>([]);
  const [studies, setStudies] = useState<LookupOption[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    Promise.all([getRoles(), getSchools(), getStudies(), getRooms()])
      .then(([roleOptions, schoolOptions, studyOptions, roomOptions]) => {
        if (!current) return;
        setRoles(roleOptions);
        setSchools(schoolOptions);
        setStudies(studyOptions);
        setRooms(roomOptions);
      })
      .catch((error) => console.error('Kunne ikke laste roller, studier og rom', error))
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [enabled]);

  return { roles, schools, studies, rooms, loading };
};
