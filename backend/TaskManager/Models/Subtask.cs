using System.ComponentModel.DataAnnotations;

namespace TaskManager.Models;

public enum SubtaskKind
{
    Restate,
    ExpectedBehavior,
    ActualBehavior,
    Categorize,
    FirstDiagnosticStep,
    NextDiagnosticStep,
    ConfirmationPlan
}

public class Subtask
{
    public int Id { get; set; }

    public int TaskItemId { get; set; }
    public TaskItem TaskItem { get; set; } = null!;

    public SubtaskKind Kind { get; set; }

    public int Order { get; set; }

    [Required]
    [MaxLength(4000)]
    public string Question { get; set; } = string.Empty;

    /// <summary>
    /// Optional per-subtask system framing. When set, <see cref="Controllers.SubtaskRunsController"/>
    /// merges this into the single user message (because Mistral v0.3's chat template refuses
    /// the <c>system</c> role outright). Different subtask kinds want different framing, so
    /// this lives on the subtask, not on a global config.
    /// </summary>
    [MaxLength(4000)]
    public string? SystemPrompt { get; set; }

    public double Temperature { get; set; } = 0.0;

    public int MaxTokens { get; set; } = 256;

    public double? TopP { get; set; }

    [MaxLength(4000)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SubtaskRun> Runs { get; set; } = new List<SubtaskRun>();
}
