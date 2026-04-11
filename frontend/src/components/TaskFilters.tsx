interface TaskFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
}

export function TaskFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  sortBy,
  onSortByChange,
}: TaskFiltersProps) {
  return (
    <div className="task-filters">
      <div className="search-box">
        <input
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-group">
        <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Pending">To Do</option>
          <option value="InProgress">In Progress</option>
          <option value="Completed">Done</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <select value={priorityFilter} onChange={(e) => onPriorityFilterChange(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>

        <select value={sortBy} onChange={(e) => onSortByChange(e.target.value)}>
          <option value="createdAt">Newest First</option>
          <option value="dueDate">Due Date</option>
          <option value="priority">Priority</option>
          <option value="title">Title</option>
        </select>
      </div>
    </div>
  );
}
