using System.ComponentModel.DataAnnotations;

namespace TaskManager.Models;

public class CreateTaskRequest
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    public TaskPriority Priority { get; set; } = TaskPriority.Medium;

    public DateTime? DueDate { get; set; }

    public DateTime? ReminderAt { get; set; }

    public string? Tags { get; set; }
}

public class UpdateTaskRequest
{
    [MaxLength(200)]
    public string? Title { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }

    public TaskPriority? Priority { get; set; }

    public TaskStatus? Status { get; set; }

    public DateTime? DueDate { get; set; }

    public DateTime? ReminderAt { get; set; }

    public string? Tags { get; set; }
}

public class TaskItemResponse
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? ReminderAt { get; set; }
    public string? Tags { get; set; }

    public static TaskItemResponse FromEntity(TaskItem task)
    {
        return new TaskItemResponse
        {
            Id = task.Id,
            Title = task.Title,
            Description = task.Description,
            Priority = task.Priority.ToString(),
            Status = task.Status.ToString(),
            CreatedAt = task.CreatedAt,
            UpdatedAt = task.UpdatedAt,
            DueDate = task.DueDate,
            ReminderAt = task.ReminderAt,
            Tags = task.Tags
        };
    }
}
