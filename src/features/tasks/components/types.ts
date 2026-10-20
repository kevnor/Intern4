import { Category, Task, TaskCreationData } from '../../../shared/types/regi/tasks';

export type FormErrors = Record<string, string>;

export type ParticipantNames = Record<string, string>;

export type TaskContactPersonOption = {
  id: string;
  name: string;
  email?: string;
};

export type TaskEditorUser = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
};

export type TasksTableProps = {
  tasks: Task[];
  categories?: Category[];
  onRowClick?: (task: Task) => void;
  onJoinTask?: (taskId: string) => void;
  onSubmitTask?: (task: Task) => void;
  busyTaskId?: string | null;
  currentUserId?: string;
  participantNames?: ParticipantNames;
};

export type TaskModalProps = {
  task: Task | null;
  onClose: () => void;
  currentUserId?: string;
  userRole?: string;
  categoryColor?: string;
  onJoinTask?: (taskId: string) => void;
  onLeaveTask?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  participantNames?: ParticipantNames;
};

export type TaskCreationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: TaskCreationData) => Promise<void>;
  onUpdateTask?: (taskId: string, taskData: TaskCreationData) => Promise<void>;
  categories: Category[];
  currentUser: TaskEditorUser | null;
  editingTask?: Task | null;
  contactPeople?: TaskContactPersonOption[];
};
