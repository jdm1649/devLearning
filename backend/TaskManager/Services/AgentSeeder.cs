using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;
using TaskManager.Models;

namespace TaskManager.Services;

/// <summary>
/// Keep the repo's canonical seed tasks (under <c>agents/tasks/</c>) present
/// in the DB, idempotently. On every startup:
///
/// <list type="bullet">
///   <item>For each seed folder, look up the matching task by its
///     <c>seed,&lt;task_id&gt;</c> tag (including soft-deleted rows).</item>
///   <item>If missing, insert it.</item>
///   <item>If present but soft-deleted, undelete it (so deleting from the UI
///     just hides it until the next restart, which is the behavior the user
///     asked for: deleted seed tasks come back on a backend start).</item>
///   <item>If present and live, leave the task alone (don't clobber user
///     edits to title/description). But re-insert any seed subtasks whose
///     kind is not yet attached, so new seed subtasks added to disk in
///     future commits flow in.</item>
/// </list>
///
/// Non-seed tasks (created in the UI) are never touched.
/// </summary>
public static class AgentSeeder
{
    public static async Task EnsureSeedTasksAsync(AppDbContext db, IHostEnvironment env, ILogger logger, CancellationToken ct = default)
    {
        var agentsTasksDir = FindAgentsTasksDir(env.ContentRootPath);
        if (agentsTasksDir is null || !Directory.Exists(agentsTasksDir))
        {
            logger.LogInformation("Seeder: no agents/tasks directory found, nothing to ensure");
            return;
        }

        logger.LogInformation("Seeder: ensuring seed tasks from {Dir}", agentsTasksDir);

        foreach (var taskDir in Directory.EnumerateDirectories(agentsTasksDir).OrderBy(d => d))
        {
            try
            {
                await EnsureOneTaskAsync(db, taskDir, logger, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Seeder: failed to ensure {Dir}", taskDir);
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeder: ensure complete");
    }

    private static async Task EnsureOneTaskAsync(AppDbContext db, string taskDir, ILogger logger, CancellationToken ct)
    {
        var taskId = Path.GetFileName(taskDir);
        var taskMd = Path.Combine(taskDir, "task.md");
        if (!File.Exists(taskMd))
        {
            logger.LogInformation("Seeder: {Dir} has no task.md, skipping", taskDir);
            return;
        }

        var taskText = (await File.ReadAllTextAsync(taskMd, ct)).Trim();
        if (taskText.Length == 0)
        {
            logger.LogInformation("Seeder: {Dir}/task.md is empty, skipping", taskDir);
            return;
        }

        var firstLine = taskText.Split('\n', 2)[0].Trim();
        var title = firstLine.Length <= 120 ? firstLine : firstLine[..117] + "...";
        var tag = $"seed,{taskId}";
        var now = DateTime.UtcNow;

        // IgnoreQueryFilters so we find soft-deleted rows too.
        var existing = await db.Tasks
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Tags == tag, ct);

        TaskItem task;
        if (existing is null)
        {
            task = new TaskItem
            {
                Title = string.IsNullOrWhiteSpace(title) ? taskId : title,
                Description = taskText,
                Priority = TaskPriority.Medium,
                Status = Models.TaskStatus.Pending,
                Tags = tag,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.Tasks.Add(task);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeder: inserted seed task {TaskId} as row #{Id}", taskId, task.Id);
        }
        else
        {
            task = existing;
            if (task.IsDeleted)
            {
                task.IsDeleted = false;
                task.UpdatedAt = now;
                logger.LogInformation("Seeder: undeleted seed task {TaskId} (row #{Id})", taskId, task.Id);
            }
            else
            {
                logger.LogInformation("Seeder: seed task {TaskId} already present as row #{Id}", taskId, task.Id);
            }
            // Don't overwrite title/description; user may have edited them.
        }

        var subtasksDir = Path.Combine(taskDir, "subtasks");
        if (!Directory.Exists(subtasksDir)) return;

        // Pull existing subtask kinds for this task so we only insert new ones.
        var existingKinds = await db.Subtasks
            .IgnoreQueryFilters()
            .Where(s => s.TaskItemId == task.Id)
            .Select(s => s.Kind)
            .ToListAsync(ct);

        foreach (var subFile in Directory.EnumerateFiles(subtasksDir, "*.json").OrderBy(f => f))
        {
            var json = await File.ReadAllTextAsync(subFile, ct);
            SeedSubtaskFile? parsed;
            try
            {
                parsed = JsonSerializer.Deserialize<SeedSubtaskFile>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Seeder: could not parse {File}", subFile);
                continue;
            }
            if (parsed is null || string.IsNullOrWhiteSpace(parsed.Kind) || string.IsNullOrWhiteSpace(parsed.Question))
            {
                logger.LogWarning("Seeder: {File} is missing kind/question", subFile);
                continue;
            }

            if (!TryMapKind(parsed.Kind, out var kind))
            {
                logger.LogWarning("Seeder: {File} has unknown kind '{Kind}'", subFile, parsed.Kind);
                continue;
            }

            if (existingKinds.Contains(kind))
            {
                // Already attached - don't duplicate, and don't clobber edits.
                continue;
            }
            existingKinds.Add(kind);

            var subtask = new Subtask
            {
                TaskItemId = task.Id,
                Kind = kind,
                Order = parsed.Order > 0 ? parsed.Order : 1,
                Question = parsed.Question,
                Temperature = parsed.ModelSettings?.Temperature ?? 0.0,
                MaxTokens = parsed.ModelSettings?.MaxTokens ?? 256,
                TopP = parsed.ModelSettings?.TopP,
                SystemPrompt = string.IsNullOrWhiteSpace(parsed.SystemPrompt) ? null : parsed.SystemPrompt,
                Notes = parsed.Notes,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.Subtasks.Add(subtask);
        }
    }

    private static bool TryMapKind(string raw, out SubtaskKind kind)
    {
        // Python uses snake_case kinds; our enum is PascalCase. Map both.
        var normalized = raw.Trim().Replace("_", "").Replace("-", "");
        return Enum.TryParse(normalized, ignoreCase: true, out kind);
    }

    private static string? FindAgentsTasksDir(string contentRoot)
    {
        // Backend runs from backend/TaskManager/. Walk up until we find
        // a sibling "agents/tasks" folder.
        var dir = new DirectoryInfo(contentRoot);
        for (int i = 0; i < 5 && dir is not null; i++, dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "agents", "tasks");
            if (Directory.Exists(candidate)) return candidate;
        }
        return null;
    }

    private class SeedSubtaskFile
    {
        [JsonPropertyName("kind")] public string? Kind { get; set; }
        [JsonPropertyName("order")] public int Order { get; set; }
        [JsonPropertyName("question")] public string? Question { get; set; }
        [JsonPropertyName("model_settings")] public SeedModelSettings? ModelSettings { get; set; }
        [JsonPropertyName("system_prompt")] public string? SystemPrompt { get; set; }
        [JsonPropertyName("notes")] public string? Notes { get; set; }
    }

    private class SeedModelSettings
    {
        [JsonPropertyName("temperature")] public double Temperature { get; set; }
        [JsonPropertyName("max_tokens")] public int MaxTokens { get; set; }
        [JsonPropertyName("top_p")] public double? TopP { get; set; }
    }
}
