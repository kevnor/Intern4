import { ResidentDirectoryUser } from '../../shared/types/user';

export type ChartDatum = {
  label: string;
  value: number;
  percentage: number;
};

export type ResidentStatistics = {
  summary: {
    totalResidents: number;
    averageAge: number | null;
    averageStudyYear: number | null;
    averageSemesters: number | null;
    mostCommonStudy: string | null;
  };
  ageGroups: ChartDatum[];
  studyYears: ChartDatum[];
  semesters: ChartDatum[];
  courses: ChartDatum[];
};

export const formatRoom = (roomNumber: number | null): string => {
  if (roomNumber === null || roomNumber === 0) return '-';
  return String(roomNumber);
};

export const formatStudy = (
  resident: Pick<ResidentDirectoryUser, 'seniority' | 'study' | 'studyPlace'>
): string => {
  const prefix = resident.seniority > 0 ? `${resident.seniority}. ` : '';
  const study = resident.study.trim();
  const studyPlace = resident.studyPlace.trim();

  if (!study && !studyPlace) return '-';
  if (!study) return studyPlace;
  if (!studyPlace) return `${prefix}${study}`;

  return `${prefix}${study} (${studyPlace})`;
};

export const formatAddress = (resident: Pick<ResidentDirectoryUser, 'address'>): string => {
  const parts = [resident.address.street, resident.address.city].filter((part) => part?.trim());
  return parts.length > 0 ? parts.join(', ') : '-';
};

const includesQuery = (value: unknown, query: string): boolean =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

export type ResidentSortKey = 'name' | 'room' | 'seniority';

// Seniority descending is the order used for room draws (romslipp); ties fall back to name.
export const sortResidents = (
  residents: ResidentDirectoryUser[],
  sortKey: ResidentSortKey
): ResidentDirectoryUser[] => {
  const byName = (a: ResidentDirectoryUser, b: ResidentDirectoryUser) =>
    a.name.localeCompare(b.name, 'no', { sensitivity: 'base' });
  const sorted = [...residents];
  if (sortKey === 'room') {
    sorted.sort(
      (a, b) =>
        (a.roomNumber || Number.MAX_SAFE_INTEGER) - (b.roomNumber || Number.MAX_SAFE_INTEGER) ||
        byName(a, b)
    );
  } else if (sortKey === 'seniority') {
    sorted.sort((a, b) => b.seniority - a.seniority || byName(a, b));
  } else {
    sorted.sort(byName);
  }
  return sorted;
};

export const filterResidents = (
  residents: ResidentDirectoryUser[],
  query: string,
  showOldResidents: boolean
): ResidentDirectoryUser[] => {
  const q = query.trim().toLowerCase();
  if (!q) return residents;

  return residents.filter((resident) => {
    const searchable = showOldResidents
      ? [
          resident.name,
          resident.address.street,
          resident.address.postalCode,
          resident.address.city,
          resident.address.country,
        ]
      : [
          resident.name,
          resident.roomNumber,
          resident.phone,
          resident.email,
          resident.study,
          resident.studyPlace,
          resident.seniority,
          resident.birthDate,
          resident.role,
        ];

    return searchable.some((value) => includesQuery(value, q));
  });
};

const toPercentage = (value: number, total: number): number => {
  if (total === 0 || value === 0) return 0;
  return Math.round((value / total) * 100);
};

const toChartData = (entries: [string, number][], total: number): ChartDatum[] =>
  entries.map(([label, value]) => ({
    label,
    value,
    percentage: toPercentage(value, total),
  }));

const countByLabel = (labels: string[], orderedLabels?: string[]): ChartDatum[] => {
  const counts = labels.reduce<Record<string, number>>((acc, label) => {
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const entries = orderedLabels
    ? orderedLabels.map((label): [string, number] => [label, counts[label] ?? 0])
    : Object.entries(counts).sort((a, b) =>
        a[0].localeCompare(b[0], 'no', { numeric: true, sensitivity: 'base' })
      );

  return toChartData(entries, labels.length);
};

const getAge = (birthDate: string | null, now: Date): number | null => {
  if (!birthDate) return null;

  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;

  const birthdayPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());

  return now.getFullYear() - date.getFullYear() - (birthdayPassed ? 0 : 1);
};

const getAgeGroup = (age: number | null): string => {
  if (age === null) return 'Ukjent';
  if (age < 20) return 'Under 20';
  if (age <= 21) return '20-21';
  if (age <= 23) return '22-23';
  if (age <= 25) return '24-25';
  return '26+';
};

const getStudyYear = (seniority: number): string => {
  if (seniority >= 1 && seniority <= 5) return String(seniority);
  return 'Ukjent';
};

const getSemesterCount = (createdAt: string | null, now: Date): number | null => {
  if (!createdAt) return null;

  const startDate = new Date(createdAt);
  if (Number.isNaN(startDate.getTime())) return null;

  const startSemester = startDate.getFullYear() * 2 + (startDate.getMonth() >= 7 ? 1 : 0);
  const currentSemester = now.getFullYear() * 2 + (now.getMonth() >= 7 ? 1 : 0);

  return Math.max(currentSemester - startSemester + 1, 1);
};

const getSemesterBucket = (semesters: number | null): string => {
  if (semesters === null) return 'Ukjent';
  if (semesters <= 2) return String(semesters);
  if (semesters <= 4) return '3-4';
  if (semesters <= 6) return '5-6';
  return '7+';
};

const average = (values: number[]): number | null => {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getStudyLabel = (resident: ResidentDirectoryUser): string => {
  const study = resident.study.trim();
  return study || 'Annet';
};

const getTopCourses = (residents: ResidentDirectoryUser[], limit = 8): ChartDatum[] => {
  const labels = residents.map(getStudyLabel);
  const total = labels.length;
  const counts = labels.reduce<Record<string, number>>((acc, label) => {
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    if (a[0] === 'Annet') return 1;
    if (b[0] === 'Annet') return -1;
    return a[0].localeCompare(b[0], 'no', { numeric: true, sensitivity: 'base' });
  });

  if (sorted.length <= limit) return toChartData(sorted, total);

  const top = sorted.slice(0, limit);
  const otherValue = sorted.slice(limit).reduce((sum, [, value]) => sum + value, 0);
  const existingOther = top.find((item) => item[0] === 'Annet');

  if (existingOther) {
    existingOther[1] += otherValue;
  } else {
    top.push(['Annet', otherValue]);
  }

  return toChartData(top, total);
};

export const buildStatistics = (
  residents: ResidentDirectoryUser[],
  now: Date = new Date()
): ResidentStatistics => {
  const ages = residents.flatMap((resident) => {
    const age = getAge(resident.birthDate, now);
    return age === null ? [] : [age];
  });
  const studyYears = residents.flatMap((resident) => {
    const studyYear = getStudyYear(resident.seniority);
    return studyYear === 'Ukjent' ? [] : [Number(studyYear)];
  });
  const semesterCounts = residents.flatMap((resident) => {
    const semesters = getSemesterCount(resident.createdAt, now);
    return semesters === null ? [] : [semesters];
  });
  const courses = getTopCourses(residents);
  const mostCommonStudy = courses.find((course) => course.value > 0)?.label ?? null;

  return {
    summary: {
      totalResidents: residents.length,
      averageAge: average(ages),
      averageStudyYear: average(studyYears),
      averageSemesters: average(semesterCounts),
      mostCommonStudy,
    },
    ageGroups: countByLabel(
      residents.map((resident) => getAgeGroup(getAge(resident.birthDate, now))),
      ['Under 20', '20-21', '22-23', '24-25', '26+', 'Ukjent']
    ),
    studyYears: countByLabel(
      residents.map((resident) => getStudyYear(resident.seniority)),
      ['1', '2', '3', '4', '5', 'Ukjent']
    ),
    semesters: countByLabel(
      residents.map((resident) => getSemesterBucket(getSemesterCount(resident.createdAt, now))),
      ['1', '2', '3-4', '5-6', '7+', 'Ukjent']
    ),
    courses,
  };
};
