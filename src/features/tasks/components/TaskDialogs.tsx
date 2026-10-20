import React from 'react';
import TaskModal from './TaskModal';
import TaskCreationModal from './TaskCreationModal';
import CategoryManagement from './CategoryManagement';
import { ConfirmDialog } from '../../../shared/components';
import type { useTaskManagement } from '../hooks/useTaskManagement';
import type { useTaskActions } from '../hooks/useTaskActions';

type TaskDialogsProps = {
  management: ReturnType<typeof useTaskManagement>;
  actions: ReturnType<typeof useTaskActions>;
  categoryColors: Record<string, string>;
};

// Every task-related dialog, so they work from any tab that lists tasks.
const TaskDialogs: React.FC<TaskDialogsProps> = ({ management, actions, categoryColors }) => {
  const {
    user,
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
    handleCreateTask,
    handleUpdateTask,
    handleJoinTask,
    handleLeaveTask,
    handleCompleteTask,
    handleDeleteTask,
    handleOpenEditTask,
    handleCloseTaskEditor,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    toggleCategoryManagement,
  } = management;
  const { submitCandidate, cancelSubmit, confirmSubmit } = actions;

  return (
    <>
      {showCategoryManagement && canManageTaskCategories && (
        <CategoryManagement
          categories={categories}
          onAddCategory={handleAddCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          getCategoryUsage={getCategoryUsageCount}
          onClose={toggleCategoryManagement}
        />
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          currentUserId={user?.id}
          userRole={user?.role}
          categoryColor={categoryColors[selectedTask.category]}
          onJoinTask={handleJoinTask}
          onLeaveTask={handleLeaveTask}
          onCompleteTask={handleCompleteTask}
          onEditTask={canCreateTasks ? handleOpenEditTask : undefined}
          onDeleteTask={canDeleteTasks ? handleDeleteTask : undefined}
          participantNames={participantNames}
        />
      )}

      {(isCreateModalOpen || !!editingTask) && (
        <TaskCreationModal
          isOpen={isCreateModalOpen || !!editingTask}
          onClose={handleCloseTaskEditor}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          categories={categories}
          currentUser={user}
          editingTask={editingTask}
          contactPeople={contactPeople}
        />
      )}

      <ConfirmDialog
        open={!!submitCandidate}
        title="Send inn til godkjenning?"
        confirmLabel="Send inn"
        onCancel={cancelSubmit}
        onConfirm={() => void confirmSubmit()}
      >
        «{submitCandidate?.title}» ({submitCandidate?.hourEstimate} timer) sendes til regisjefen for
        godkjenning.
      </ConfirmDialog>
    </>
  );
};

export default TaskDialogs;
