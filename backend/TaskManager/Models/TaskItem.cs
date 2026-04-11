using System.ComponentModel.DataAnnotations;

namespace TaskManager.Models;

public enum TaskPriority
{
    Low,
    Medium,
    High,
    Urgent
}

public enum TaskStatus
{
    Pending,
    InProgress,
    Completed,
    Cancelled
}

public class TaskItem
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    public TaskPriority Priority { get; set; } = TaskPriority.Medium;

    public TaskStatus Status { get; set; } = TaskStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? DueDate { get; set; }

    public DateTime? ReminderAt { get; set; }

    public bool IsDeleted { get; set; } = false;

    [MaxLength(500)]
    public string? Tags { get; set; }
}
