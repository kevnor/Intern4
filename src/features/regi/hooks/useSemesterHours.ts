import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SEMESTER_HOURS } from '../../../app/constants/regiRequirements';
import { getRequiredHours, setRequiredHours } from '../../../server/dao/semesterSettingsDAO';
import { getSemester } from '../../../shared/utils/semester';

// Total hours each resident owes this semester. Falls back to the default while loading, when no
// value has been configured, or if the setting can't be read.
export const useSemesterHours = () => {
  const [totalHours, setTotalHours] = useState(DEFAULT_SEMESTER_HOURS);
  const [loading, setLoading] = useState(true);
  const semesterKey = getSemester().key;

  useEffect(() => {
    let cancelled = false;
    getRequiredHours(semesterKey)
      .then((hours) => {
        if (!cancelled && hours !== undefined) setTotalHours(hours);
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [semesterKey]);

  const save = useCallback(
    async (hours: number) => {
      await setRequiredHours(semesterKey, hours);
      setTotalHours(hours);
    },
    [semesterKey]
  );

  return { totalHours, loading, save };
};
