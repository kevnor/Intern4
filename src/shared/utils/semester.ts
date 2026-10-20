// Spring semester starts 1 January, autumn semester 1 August.
export const getSemesterStart = (now: Date = new Date()): Date => {
  const year = now.getFullYear();
  return now.getMonth() < 7 ? new Date(year, 0, 1) : new Date(year, 7, 1);
};

export const getSemesterName = (now: Date = new Date()): string =>
  `${now.getMonth() < 7 ? 'Vår' : 'Høst'} ${now.getFullYear()}`;

export type Semester = {
  key: string; // e.g. "2026-H"
  name: string; // e.g. "Høst 2026"
  start: Date; // first day
  end: Date; // first day of the next semester
};

export const getSemester = (date: Date = new Date()): Semester => {
  const start = getSemesterStart(date);
  const autumn = start.getMonth() === 7;
  const end = autumn
    ? new Date(start.getFullYear() + 1, 0, 1)
    : new Date(start.getFullYear(), 7, 1);
  return {
    key: `${start.getFullYear()}-${autumn ? 'H' : 'V'}`,
    name: getSemesterName(start),
    start,
    end,
  };
};

// Semesters from the one containing `earliest` up to the current one, newest first.
// The current semester is always included.
export const listSemesters = (earliest: Date, now: Date = new Date()): Semester[] => {
  const semesters = [getSemester(now)];
  const first = getSemesterStart(earliest).getTime();
  for (;;) {
    const previousDay = new Date(
      semesters[semesters.length - 1].start.getTime() - 24 * 60 * 60 * 1000
    );
    const previous = getSemester(previousDay);
    if (previous.start.getTime() < first) return semesters;
    semesters.push(previous);
  }
};
