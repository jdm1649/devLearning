export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatusType = 'Pending' | 'InProgress' | 'Completed' | 'Cancelled';

export interface TaskItem {
  id: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatusType;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  reminderAt: string | null;
  tags: string | null;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
  reminderAt?: string;
  tags?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatusType;
  dueDate?: string;
  reminderAt?: string;
  tags?: string;
}
