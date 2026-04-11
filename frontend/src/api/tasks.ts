import type { TaskItem, CreateTaskRequest, UpdateTaskRequest } from '../types/task';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5151/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function fetchTasks(params?: {
  status?: string;
  priority?: string;
  search?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<TaskItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortDir) searchParams.set('sortDir', params.sortDir);

  const url = `${API_BASE}/tasks${searchParams.toString() ? '?' + searchParams : ''}`;
  const res = await fetch(url);
  return handleResponse<TaskItem[]>(res);
}

export async function createTask(task: CreateTaskRequest): Promise<TaskItem> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  return handleResponse<TaskItem>(res);
}

export async function updateTask(id: number, task: UpdateTaskRequest): Promise<TaskItem> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  return handleResponse<TaskItem>(res);
}

export async function updateTaskStatus(id: number, status: string): Promise<TaskItem> {
  const res = await fetch(`${API_BASE}/tasks/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return handleResponse<TaskItem>(res);
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
  return handleResponse<void>(res);
}
