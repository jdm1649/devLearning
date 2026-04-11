import { useState } from 'react';
import type { CreateTaskRequest, TaskPriority } from '../types/task';

interface TaskFormProps {
  onSubmit: (task: CreateTaskRequest) => void;
  onCancel: () => void;
}

export function TaskForm({ onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      tags: tags.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="task-form">
      <h2>New Task</h2>

      <div className="form-group">
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          autoFocus
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details..."
          rows={3}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="dueDate">Due Date</label>
          <input
            id="dueDate"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="tags">Tags</label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. work, personal, urgent"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">Create Task</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
