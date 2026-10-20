import { useMemo, useState } from 'react';
import { Category, Task, canUserJoinTask } from '../../../shared/types/regi/tasks';

export const useTasks = (
  tasks: Task[],
  categories: Category[],
  currentUser: string,
  participantNames: Record<string, string>,
  tasksPerPage = 10
) => {
  const [query, setQueryState] = useState('');
  const [filter, setFilterState] = useState('available');
  const [category, setCategoryState] = useState('all');
  const [requestedPage, setCurrentPage] = useState(1);

  // Changing what is shown starts from the first page again.
  const setQuery = (value: string) => {
    setQueryState(value);
    setCurrentPage(1);
  };
  const setFilter = (value: string) => {
    setFilterState(value);
    setCurrentPage(1);
  };
  const setCategory = (value: string) => {
    setCategoryState(value);
    setCurrentPage(1);
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (filter === 'available') {
      filtered = filtered.filter((task) => canUserJoinTask(task, currentUser));
    } else if (filter === 'myTasks') {
      filtered = filtered.filter((task) =>
        task.participants.some((participant) => participant.userId === currentUser)
      );
    }

    if (category !== 'all') {
      filtered = filtered.filter((t) => t.category === category);
    }

    if (query) {
      const lowerCaseQuery = query.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(lowerCaseQuery) ||
          t.category.toLowerCase().includes(lowerCaseQuery) ||
          t.description?.toLowerCase().includes(lowerCaseQuery) ||
          (t.contactPersonId
            ? (participantNames[t.contactPersonId] ?? '').toLowerCase()
            : ''
          ).includes(lowerCaseQuery)
      );
    }

    return filtered;
  }, [tasks, query, filter, category, currentUser, participantNames]);

  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
  // The list can shrink under the current page (e.g. after leaving a task), so clamp it.
  const currentPage = Math.min(requestedPage, Math.max(totalPages, 1));

  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * tasksPerPage;
    return filteredTasks.slice(startIndex, startIndex + tasksPerPage);
  }, [filteredTasks, currentPage, tasksPerPage]);

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Use the categories from the database instead of extracting from tasks
  const availableCategories = useMemo(() => {
    return ['all', ...categories.map((c) => c.name)];
  }, [categories]);

  return {
    query,
    setQuery,
    filter,
    setFilter,
    category,
    setCategory,
    currentPage,
    setCurrentPage,
    paginatedTasks,
    totalPages,
    nextPage,
    prevPage,
    categories: availableCategories,
    filteredTasks,
  };
};
