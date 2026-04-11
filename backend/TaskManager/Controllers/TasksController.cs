using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;
using TaskManager.Models;
using TaskStatus = TaskManager.Models.TaskStatus;

namespace TaskManager.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    private readonly AppDbContext _db;

    public TasksController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<TaskItemResponse>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] string? search,
        [FromQuery] string sortBy = "createdAt",
        [FromQuery] string sortDir = "desc")
    {
        var query = _db.Tasks.AsQueryable();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<TaskStatus>(status, true, out var s))
            query = query.Where(t => t.Status == s);

        if (!string.IsNullOrEmpty(priority) && Enum.TryParse<TaskPriority>(priority, true, out var p))
            query = query.Where(t => t.Priority == p);

        if (!string.IsNullOrEmpty(search))
            query = query.Where(t => t.Title.Contains(search) || (t.Description != null && t.Description.Contains(search)));

        query = sortBy.ToLower() switch
        {
            "title" => sortDir == "asc" ? query.OrderBy(t => t.Title) : query.OrderByDescending(t => t.Title),
            "priority" => sortDir == "asc" ? query.OrderBy(t => t.Priority) : query.OrderByDescending(t => t.Priority),
            "duedate" => sortDir == "asc" ? query.OrderBy(t => t.DueDate) : query.OrderByDescending(t => t.DueDate),
            "status" => sortDir == "asc" ? query.OrderBy(t => t.Status) : query.OrderByDescending(t => t.Status),
            _ => sortDir == "asc" ? query.OrderBy(t => t.CreatedAt) : query.OrderByDescending(t => t.CreatedAt),
        };

        var tasks = await query.ToListAsync();
        return tasks.Select(TaskItemResponse.FromEntity).ToList();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TaskItemResponse>> GetById(int id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task == null) return NotFound();
        return TaskItemResponse.FromEntity(task);
    }

    [HttpPost]
    public async Task<ActionResult<TaskItemResponse>> Create(CreateTaskRequest request)
    {
        var task = new TaskItem
        {
            Title = request.Title,
            Description = request.Description,
            Priority = request.Priority,
            DueDate = request.DueDate,
            ReminderAt = request.ReminderAt,
            Tags = request.Tags,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Tasks.Add(task);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = task.Id }, TaskItemResponse.FromEntity(task));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TaskItemResponse>> Update(int id, UpdateTaskRequest request)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task == null) return NotFound();

        if (request.Title != null) task.Title = request.Title;
        if (request.Description != null) task.Description = request.Description;
        if (request.Priority.HasValue) task.Priority = request.Priority.Value;
        if (request.Status.HasValue) task.Status = request.Status.Value;
        if (request.DueDate.HasValue) task.DueDate = request.DueDate.Value;
        if (request.ReminderAt.HasValue) task.ReminderAt = request.ReminderAt.Value;
        if (request.Tags != null) task.Tags = request.Tags;

        task.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return TaskItemResponse.FromEntity(task);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task == null) return NotFound();

        task.IsDeleted = true;
        task.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("{id}/status")]
    public async Task<ActionResult<TaskItemResponse>> UpdateStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task == null) return NotFound();

        if (!Enum.TryParse<TaskStatus>(request.Status, true, out var newStatus))
            return BadRequest("Invalid status value");

        task.Status = newStatus;
        task.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return TaskItemResponse.FromEntity(task);
    }
}

public class UpdateStatusRequest
{
    public string Status { get; set; } = string.Empty;
}
