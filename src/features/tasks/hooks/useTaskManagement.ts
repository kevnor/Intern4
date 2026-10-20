import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthContext';
import {
  addTask,
  deleteTask,
  joinTask,
  leaveTask,
  submitTaskCompletion,
  updateTask,
} from '../../../server/dao/tasksDAO';
import {
  addCategory,
  deleteCategory,
  getCategoryUsageCount,
  updateCategory,
} from '../../../server/dao/categoriesDAO';
import {
  Category,
  CategoryCreationData,
  Task,
  TaskCreationData,
} from '../../../shared/types/regi/tasks';
import { canManageCategories, canManageTasks } from '../permissions';
import { useTasks } from './useTasks';
import { useTaskManagementData } from './useTaskManagementData';

type StatusMessage = { type: 'success' | 'error'; text: string };

type UseTaskManagementOptions = {
  // Called after the user's own assignments change (join, leave, submit), e.g. to reload hours.
  onAssignmentsChanged?: () => void;
};

export const useTaskManagement = ({ onAssignmentsChanged }: UseTaskManagementOptions = {}) => {
  const onAssignmentsChangedRef = useRef(onAssignmentsChanged);
  useLayoutEffect(() => {
    onAssignmentsChangedRef.current = onAssignmentsChanged;
  });

  const authData = useAuth();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCategoryManagement, setShowCategoryManagement] = useState<boolean>(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const {
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
  } = useTaskManagementData(authData?.user?.id);

  const user = authData?.user ?? null;
  const authLoading = authData?.loading || false;

  const taskList = useTasks(tasks, categories, user?.id || '', participantNames, 10);

  const canCreateTasks = canManageTasks(user?.role);
  const canManageTaskCategories = canManageCategories(user?.role);
  const canDeleteTasks = canManageTasks(user?.role);

  const showSuccessMessage = useCallback(
    (nextMessage: string): void => {
      clearError();
      setMessage({ type: 'success', text: nextMessage });
    },
    [clearError]
  );

  const showErrorMessage = useCallback((nextMessage: string): void => {
    console.error('Error:', nextMessage);
    setMessage({ type: 'error', text: nextMessage });
  }, []);

  useEffect(() => {
    if (!message) return undefined;

    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const handleCreateTask = async (taskData: TaskCreationData): Promise<void> => {
    try {
      await addTask(taskData);
      await loadData();
      setIsCreateModalOpen(false);
      showSuccessMessage('Oppgave opprettet!');
    } catch (err) {
      console.error('Error creating task:', err);
      const message = err instanceof Error ? err.message : 'Kunne ikke opprette oppgave';
      showErrorMessage(message);
      throw err instanceof Error ? err : new Error(message);
    }
  };

  const handleUpdateTask = async (taskId: string, taskData: TaskCreationData): Promise<void> => {
    try {
      await updateTask(taskId, taskData);
      await loadData();
      setEditingTask(null);
      setSelectedTask(null);
      showSuccessMessage('Oppgave oppdatert!');
    } catch (err) {
      console.error('Error updating task:', err);
      const message = err instanceof Error ? err.message : 'Kunne ikke oppdatere oppgave';
      showErrorMessage(message);
      throw err instanceof Error ? err : new Error(message);
    }
  };

  const handleJoinTask = async (taskId: string): Promise<void> => {
    if (!user?.id) return;

    try {
      await joinTask(taskId, user.id);
      await loadData();
      onAssignmentsChangedRef.current?.();
      setSelectedTask(null);
      showSuccessMessage('Du er nå påmeldt oppgaven!');
    } catch (err) {
      console.error('Error joining task:', err);
      showErrorMessage(err instanceof Error ? err.message : 'Kunne ikke melde deg på oppgaven');
    }
  };

  const handleLeaveTask = async (taskId: string): Promise<void> => {
    if (!user?.id) return;

    try {
      await leaveTask(taskId, user.id);
      await loadData();
      onAssignmentsChangedRef.current?.();
      setSelectedTask(null);
      showSuccessMessage('Du er nå avmeldt oppgaven');
    } catch (err) {
      console.error('Error leaving task:', err);
      showErrorMessage(err instanceof Error ? err.message : 'Kunne ikke melde deg av oppgaven');
    }
  };

  const handleCompleteTask = async (taskId: string): Promise<void> => {
    if (!user?.id) return;

    try {
      await submitTaskCompletion(taskId, user.id);
      await loadData();
      onAssignmentsChangedRef.current?.();
      setSelectedTask(null);
      showSuccessMessage('Oppgaven er sendt inn til godkjenning!');
    } catch (err) {
      console.error('Error completing task:', err);
      showErrorMessage(err instanceof Error ? err.message : 'Kunne ikke sende inn oppgaven');
    }
  };

  const handleDeleteTask = async (taskId: string): Promise<void> => {
    if (!canDeleteTasks) {
      showErrorMessage('Du har ikke tillatelse til å slette oppgaver');
      return;
    }

    try {
      await deleteTask(taskId);
      await loadData();
      setSelectedTask(null);
      showSuccessMessage('Oppgave slettet!');
    } catch (err) {
      console.error('Error deleting task:', err);
      showErrorMessage(err instanceof Error ? err.message : 'Kunne ikke slette oppgave');
    }
  };

  const handleOpenCreateTask = (): void => {
    setEditingTask(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditTask = (task: Task): void => {
    setSelectedTask(null);
    setIsCreateModalOpen(false);
    setEditingTask(task);
  };

  const handleCloseTaskEditor = (): void => {
    setIsCreateModalOpen(false);
    setEditingTask(null);
  };

  const handleAddCategory = async (categoryData: CategoryCreationData): Promise<void> => {
    try {
      const categoryId = await addCategory(categoryData);
      addCategoryToState({
        id: categoryId,
        name: categoryData.name,
        description: categoryData.description,
        color: categoryData.color,
        isActive: categoryData.isActive,
        createdAt: new Date(),
      });
      showSuccessMessage('Kategori opprettet!');
    } catch (err) {
      console.error('Error adding category:', err);
      showErrorMessage('Kunne ikke opprette kategori');
      throw err instanceof Error ? err : new Error('Kunne ikke opprette kategori');
    }
  };

  const handleUpdateCategory = async (
    categoryId: string,
    categoryData: Partial<Category>
  ): Promise<void> => {
    try {
      await updateCategory(categoryId, categoryData);
      updateCategoryInState(categoryId, categoryData);
      showSuccessMessage('Kategori oppdatert!');
    } catch (err) {
      console.error('Error updating category:', err);
      showErrorMessage('Kunne ikke oppdatere kategori');
      throw err instanceof Error ? err : new Error('Kunne ikke oppdatere kategori');
    }
  };

  const handleDeleteCategory = async (categoryId: string): Promise<void> => {
    try {
      await deleteCategory(categoryId);
      removeCategoryFromState(categoryId);
      showSuccessMessage('Kategori slettet!');
    } catch (err) {
      console.error('Error deleting category:', err);
      showErrorMessage('Kunne ikke slette kategori');
      throw err instanceof Error ? err : new Error('Kunne ikke slette kategori');
    }
  };

  const toggleCategoryManagement = (): void => {
    setShowCategoryManagement((current) => !current);
  };

  return {
    user,
    authLoading,
    loading,
    refreshing,
    error,
    message,
    clearMessage: () => setMessage(null),
    tasks,
    categories,
    selectedTask,
    setSelectedTask,
    isCreateModalOpen,
    editingTask,
    showCategoryManagement,
    participantNames,
    contactPeople,
    canCreateTasks,
    canManageTaskCategories,
    canDeleteTasks,
    getCategoryUsageCount,
    taskList,
    includeOlder,
    showOlderTasks,
    handleCreateTask,
    handleUpdateTask,
    handleJoinTask,
    handleLeaveTask,
    handleCompleteTask,
    handleDeleteTask,
    handleOpenCreateTask,
    handleOpenEditTask,
    handleCloseTaskEditor,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    toggleCategoryManagement,
  };
};
