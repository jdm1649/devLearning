using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskManager.Data;
using TaskManager.Models;
using TaskManager.Services;

namespace TaskManager.Controllers;

[ApiController]
public class SubtaskRunsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly LMStudioClient _lm;
    private readonly ILogger<SubtaskRunsController> _logger;

    public SubtaskRunsController(AppDbContext db, LMStudioClient lm, ILogger<SubtaskRunsController> logger)
    {
        _db = db;
        _lm = lm;
        _logger = logger;
    }

    [HttpGet("api/subtasks/{subtaskId}/runs")]
    public async Task<ActionResult<List<SubtaskRunResponse>>> ListForSubtask(int subtaskId)
    {
        var exists = await _db.Subtasks.AnyAsync(s => s.Id == subtaskId);
        if (!exists) return NotFound();

        var runs = await _db.SubtaskRuns
            .Where(r => r.SubtaskId == subtaskId)
            .OrderByDescending(r => r.StartedAt)
            .ToListAsync();
        return runs.Select(SubtaskRunResponse.FromEntity).ToList();
    }

    [HttpPost("api/subtasks/{subtaskId}/runs")]
    public async Task<ActionResult<SubtaskRunResponse>> Run(int subtaskId, RunSubtaskRequest request, CancellationToken ct)
    {
        var subtask = await _db.Subtasks
            .Include(s => s.TaskItem)
            .FirstOrDefaultAsync(s => s.Id == subtaskId, ct);
        if (subtask is null) return NotFound();

        var taskText = BuildTaskText(subtask.TaskItem, request.ContextSource);
        if (string.IsNullOrWhiteSpace(taskText))
        {
            return BadRequest(new
            {
                error = "empty-task-context",
                message = $"The selected context source ({request.ContextSource}) produced an empty string. Give the task a title or description first.",
            });
        }
        var effectiveSystemPrompt = string.IsNullOrWhiteSpace(subtask.SystemPrompt) ? null : subtask.SystemPrompt.Trim();
        var prompt = BuildPrompt(effectiveSystemPrompt, subtask.Question, taskText);

        var messages = new List<LMStudioChatMessage>
        {
            new() { Role = "user", Content = prompt },
        };

        if (IsPromptOverBudget(prompt, _lm.Options.MaxPromptTokens, out var estimated))
        {
            return BadRequest(new
            {
                error = "prompt-over-budget",
                estimatedTokens = estimated,
                maxPromptTokens = _lm.Options.MaxPromptTokens,
                message = $"Built prompt is ~{estimated} tokens, exceeding the {_lm.Options.MaxPromptTokens} budget. Shorten the task or the subtask question, or raise LMStudio:MaxPromptTokens.",
            });
        }

        LMStudioChatResult chatResult;
        try
        {
            chatResult = await _lm.ChatAsync(
                messages,
                subtask.Temperature,
                subtask.MaxTokens,
                subtask.TopP,
                ct);
        }
        catch (LMStudioException ex)
        {
            _logger.LogWarning(ex, "LM Studio call failed for subtask {SubtaskId}", subtaskId);
            return StatusCode(502, new { error = "lmstudio-failure", message = ex.Message });
        }

        var run = new SubtaskRun
        {
            SubtaskId = subtask.Id,
            StartedAt = DateTime.UtcNow,
            Model = _lm.Options.Model,
            SentMessagesJson = JsonSerializer.Serialize(messages),
            SentTemperature = subtask.Temperature,
            SentMaxTokens = subtask.MaxTokens,
            SentTopP = subtask.TopP,
            SystemPrompt = effectiveSystemPrompt,
            ResponseContent = chatResult.Content,
            StopReason = chatResult.StopReason,
            TokensPerSecond = chatResult.TokensPerSecond,
            TimeToFirstToken = chatResult.TimeToFirstToken,
            PromptTokens = chatResult.PromptTokens,
            CompletionTokens = chatResult.CompletionTokens,
            TotalTokens = chatResult.TotalTokens,
            Quant = chatResult.Quant,
            ContextLength = chatResult.ContextLength,
            Runtime = chatResult.Runtime,
            UserNotes = request.UserNotes,
        };
        _db.SubtaskRuns.Add(run);
        await _db.SaveChangesAsync(ct);

        return SubtaskRunResponse.FromEntity(run);
    }

    /// <summary>
    /// Compose the single user message. When <paramref name="systemPrompt"/> is
    /// non-null we emit a 3-section layout (SYSTEM / INSTRUCTION / TASK) instead
    /// of the default 2-section (INSTRUCTION / TASK). We do this instead of
    /// using a real <c>system</c> role because Mistral v0.3's chat template
    /// refuses the system role and 400s the whole request.
    /// </summary>
    private static string BuildPrompt(string? systemPrompt, string question, string taskText)
    {
        if (systemPrompt is null)
        {
            return $"{question.Trim()}\n\nTASK:\n{taskText.Trim()}";
        }
        return $"[SYSTEM]\n{systemPrompt.Trim()}\n\n[INSTRUCTION]\n{question.Trim()}\n\n[TASK]\n{taskText.Trim()}";
    }

    private static string BuildTaskText(TaskItem task, RunContextSource source)
    {
        var title = (task.Title ?? string.Empty).Trim();
        var description = (task.Description ?? string.Empty).Trim();

        return source switch
        {
            RunContextSource.TitleOnly => title,
            RunContextSource.DescriptionOnly => description,
            RunContextSource.TitleAndDescription => string.IsNullOrEmpty(description)
                ? title
                : string.IsNullOrEmpty(title)
                    ? description
                    : $"{title}\n\n{description}",
            RunContextSource.DescriptionWithTitleFallback => string.IsNullOrEmpty(description) ? title : description,
            _ => description,
        };
    }

    /// <summary>
    /// Pessimistic char-based token estimate: matches the Python CLI guard
    /// at ~3 chars/token. We'd rather abort early on a borderline prompt
    /// than silently truncate.
    /// </summary>
    private static bool IsPromptOverBudget(string text, int maxTokens, out int estimated)
    {
        estimated = Math.Max(1, text.Length / 3);
        return estimated > maxTokens;
    }
}
