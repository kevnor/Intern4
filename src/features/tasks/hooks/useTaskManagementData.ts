import { useCallback, useEffect, useState } from 'react';
import { getCategories } from '../../../server/dao/categoriesDAO';
import { getTasks } from '../../../server/dao/tasksDAO';
import { getActiveUsersWithRole, getUserNames } from '../../../server/dao/userDAO';
import { Category, Task } from '../../../shared/types/regi/tasks';
import { ParticipantNames, TaskContactPersonOption } from '../components/types';
import { getSemesterStart } from '../../../shared/utils/semester';

export const useTaskManagementData = (userId?: string) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  // By default only this semester's and still-open tasks are loaded; see getTasks.
  const [includeOlder, setIncludeOlder] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [participantNames, setParticipantNames] = useState<ParticipantNames>({});
  const [contactPeople, setContactPeople] = useState<TaskContactPersonOption[]>([]);
  // `loading` covers only the first load; later reloads set `refreshing` so the page stays visible.
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Names of active users come with the contact-person list; only former residents still
  // on old tasks need a separate lookup.
  const loadParticipantNames = useCallback(
    async (tasksData: Task[], knownNames: ParticipantNames): Promise<void> => {
      const allParticipantIds = new Set<string>();
      tasksData.forEach((task) => {
        task.participants.forEach((participant) => allParticipantIds.add(participant.userId));
        if (task.contactPersonId) {
          allParticipantIds.add(task.contactPersonId);
        }
      });

      const ids = Array.from(allParticipantIds);
      const unknownIds = ids.filter((userId) => !knownNames[userId]);
      let names: ParticipantNames = knownNames;
      if (unknownIds.length > 0) {
        try {
          names = { ...knownNames, ...(await getUserNames(unknownIds)) };
        } catch (namesError) {
          console.error(namesError);
        }
      }
      const nameMap = Object.fromEntries(
        ids.map((userId) => [userId, names[userId] || 'Ukjent bruker'])
      ) as ParticipantNames;

      setParticipantNames(nameMap);
    },
    []
  );

  const loadData = useCallback(async (): Promise<void> => {
    try {
      setRefreshing(true);
      setError(null);

      const [tasksData, categoriesData, activeUsers] = await Promise.all([
        getTasks(includeOlder ? undefined : { since: getSemesterStart(), userId }),
        getCategories(),
        getActiveUsersWithRole(),
      ]);

      setTasks(tasksData);
      setCategories(categoriesData);
      setContactPeople(
        activeUsers.map((activeUser) => ({
          id: activeUser.id,
          name: activeUser.name,
          email: activeUser.email,
        }))
      );

      if (tasksData.length > 0) {
        await loadParticipantNames(
          tasksData,
          Object.fromEntries(activeUsers.map((activeUser) => [activeUser.id, activeUser.name]))
        );
      } else {
        setParticipantNames({});
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Kunne ikke laste data. Prøv å oppdatere siden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadParticipantNames, includeOlder, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const clearError = useCallback(() => setError(null), []);
  const showOlderTasks = useCallback(() => setIncludeOlder(true), []);

  const sortCategories = useCallback(
    (nextCategories: Category[]): Category[] =>
      [...nextCategories].sort((a, b) => a.name.localeCompare(b.name, 'no')),
    []
  );

  const addCategoryToState = useCallback(
    (category: Category): void => {
      setCategories((current) => sortCategories([...current, category]));
    },
    [sortCategories]
  );

  const updateCategoryInState = useCallback(
    (categoryId: string, categoryData: Partial<Category>): void => {
      setCategories((current) =>
        sortCategories(
          current.map((category) => {
            if (category.id !== categoryId) {
              return category;
            }

            const nextName = categoryData.name;
            if (nextName && category.name !== nextName) {
              const previousName = category.name;
              setTasks((currentTasks) =>
                currentTasks.map((task) =>
                  task.category === previousName ? { ...task, category: nextName } : task
                )
              );
            }

            return { ...category, ...categoryData };
          })
        )
      );
    },
    [sortCategories]
  );

  const removeCategoryFromState = useCallback((categoryId: string): void => {
    setCategories((current) => current.filter((category) => category.id !== categoryId));
  }, []);

  return {
    tasks,
    categories,
    participantNames,
    contactPeople,
    loading,
    refreshing,
    error,
    clearError,
    loadData,
    includeOlder,
    showOlderTasks,
    addCategoryToState,
    updateCategoryInState,
    removeCategoryFromState,
  };
};
