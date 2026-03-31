package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grittyfitness/api/internal/ai"
	"github.com/grittyfitness/api/internal/chat"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
	"github.com/grittyfitness/api/internal/usage"
	"google.golang.org/genai"
)

// isValidUUID checks whether s looks like a valid UUID (8-4-4-4-12 hex format).
func isValidUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
		} else if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func intFromAny(v any, defaultVal int) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	}
	return defaultVal
}

// ActivityTypes is the canonical set of activity types the LLM must choose from.
// Human-readable format — stored as-is in the DB. The frontend normalizes to snake_case for icon/display lookup.
var ActivityTypes = []string{
	"Easy Run", "Long Run", "Tempo Run", "Interval Run", "Trail Run", "Indoor Run", "Run",
	"Walk", "Swim", "Open Water Swim",
	"Strength Training", "Cycling", "Indoor Cycling",
	"Mobility", "Yoga", "Recovery", "Rest",
	"Drill", "Cross Training",
	"Outdoor Activity", "Indoor Activity",
}

// phaseSchema returns the genai.Schema for a single phase used by save_draft_phase and update_draft_phase.
func phaseSchema() map[string]*genai.Schema {
	return map[string]*genai.Schema{
		"name":           {Type: genai.TypeString, Description: "Phase name (e.g. Base, Build, Peak, Taper)"},
		"order_index":    {Type: genai.TypeInteger, Description: "0-based phase order"},
		"start_date":     {Type: genai.TypeString, Description: "Phase start date (YYYY-MM-DD)"},
		"end_date":       {Type: genai.TypeString, Description: "Phase end date (YYYY-MM-DD)"},
		"duration_weeks": {Type: genai.TypeInteger, Description: "Number of weeks this template repeats"},
		"template_week": {
			Type:        genai.TypeObject,
			Description: "A single week template (Mon-Sun) that repeats for duration_weeks",
			Required:    []string{"activities"},
			Properties: map[string]*genai.Schema{
				"activities": {
					Type: genai.TypeArray,
					Items: &genai.Schema{
						Type:     genai.TypeObject,
						Required: []string{"day_of_week", "activity_type", "prescription"},
						Properties: map[string]*genai.Schema{
							"day_of_week":   {Type: genai.TypeInteger, Description: "0=Sunday, 1=Monday, ..., 6=Saturday"},
							"activity_type": {Type: genai.TypeString, Description: "The activity type. Use notes for descriptive detail.", Enum: ActivityTypes},
							"prescription":  {Type: genai.TypeObject, Description: "Activity details like distance, pace, sets, reps"},
							"notes":         {Type: genai.TypeString, Description: "Descriptive context (e.g. Squat focus, Hill repeats, Upper body)"},
							"order_index":   {Type: genai.TypeInteger},
						},
					},
				},
			},
		},
	}
}

// parsePhaseParams marshals a params map into a TemplatePhaseInput.
func parsePhaseParams(params map[string]any) (models.TemplatePhaseInput, error) {
	phaseJSON, err := json.Marshal(params)
	if err != nil {
		return models.TemplatePhaseInput{}, fmt.Errorf("marshal phase: %w", err)
	}
	var phase models.TemplatePhaseInput
	if err := json.Unmarshal(phaseJSON, &phase); err != nil {
		return models.TemplatePhaseInput{}, fmt.Errorf("unmarshal phase: %w", err)
	}
	if phase.Name == "" || phase.DurationWeeks <= 0 {
		return models.TemplatePhaseInput{}, fmt.Errorf("name and duration_weeks are required")
	}
	return phase, nil
}

func RegisterAllTools(reg *Registry, programSvc *services.ProgramService, userSvc *services.UserService, proposals *ProposalStore, skillLoader *ai.SkillLoader, usageSvc *usage.Service) {
	reg.Register(&Tool{
		Name:        "read_skill",
		Modes:       []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation, chat.ModeProgramManagement, chat.ModeWorkoutReview},
		Description: "Load sport-specific training knowledge for exercise selection, periodization, and pacing. Use when creating or modifying programs to get domain expertise.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"skill_name"},
			Properties: map[string]*genai.Schema{
				"skill_name": {
					Type:        genai.TypeString,
					Description: "The sport or training domain to load knowledge for",
					Enum:        skillLoader.Names(),
				},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			skillName, _ := params["skill_name"].(string)
			if skillName == "" {
				return nil, fmt.Errorf("skill_name is required")
			}
			content, err := skillLoader.GetSkill(skillName)
			if err != nil {
				return nil, err
			}
			return map[string]string{"instructions": content}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "get_user_profile",
		Modes:       []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation},
		Description: "Get the user's profile information including name, timezone, and units preference",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			return userSvc.GetByID(ctx, userID)
		},
	})

	reg.Register(&Tool{
		Name:        "get_active_program",
		Modes:       []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation, chat.ModeProgramManagement, chat.ModeWorkoutReview},
		Description: "Get the user's currently active training program with all phases, weeks, scheduled activities, and criteria",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			program, err := programSvc.GetActiveProgram(ctx, userID)
			if err != nil {
				return nil, err
			}
			if program == nil {
				return map[string]string{"status": "no_active_program"}, nil
			}
			return program, nil
		},
	})

	reg.Register(&Tool{
		Name:        "get_program_criteria",
		Modes:       []chat.Mode{chat.ModeProgramManagement},
		Description: "Get the criteria/settings for a specific program",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"program_id"},
			Properties: map[string]*genai.Schema{
				"program_id": {Type: genai.TypeString, Description: "The program ID"},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			programID, _ := params["program_id"].(string)
			if programID == "" {
				return nil, fmt.Errorf("program_id is required")
			}
			return programSvc.GetCriteria(ctx, programID, userID)
		},
	})

	reg.Register(&Tool{
		Name:        "get_draft_program",
		Modes:       []chat.Mode{chat.ModeProgramCreation},
		Description: "Check if the user has an existing draft program from a previous conversation. Returns the draft with saved criteria, or no_draft_found.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			draft, err := programSvc.GetDraftProgram(ctx, userID)
			if err != nil {
				return nil, err
			}
			if draft == nil {
				return map[string]string{"status": "no_draft_found"}, nil
			}
			return draft, nil
		},
	})

	reg.Register(&Tool{
		Name:        "create_draft_program",
		Modes:       []chat.Mode{chat.ModeProgramCreation},
		Description: "Create a draft program to save progress incrementally. Call this once you know the sport or program name. Does NOT archive the active program.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"name"},
			Properties: map[string]*genai.Schema{
				"name":  {Type: genai.TypeString, Description: "Program name"},
				"sport": {Type: genai.TypeString, Description: "Sport or activity (optional)"},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			if allowed, _ := usageSvc.CanCreateDraft(ctx, userID); !allowed {
				return map[string]any{
					"status":  "blocked",
					"reason":  "free_tier_limit",
					"message": "You've reached your free draft program limit (3). Delete an existing draft or upgrade to premium.",
				}, nil
			}

			name, _ := params["name"].(string)
			if name == "" {
				return nil, fmt.Errorf("name is required")
			}
			sport, _ := params["sport"].(string)
			result, err := programSvc.CreateDraftProgram(ctx, userID, name, sport)
			if err != nil {
				return nil, err
			}
			return map[string]any{"program_id": result.ID}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "save_draft_criterion",
		Modes:       []chat.Mode{chat.ModeProgramCreation},
		Description: "Save a single criterion to the draft program. Call after each meaningful user answer to persist progress.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"program_id", "key", "label", "value"},
			Properties: map[string]*genai.Schema{
				"program_id":    {Type: genai.TypeString, Description: "The draft program ID"},
				"key":           {Type: genai.TypeString, Description: "Criterion key (e.g. sport, experience_level)"},
				"label":         {Type: genai.TypeString, Description: "Human-readable label"},
				"value":         {Type: genai.TypeString, Description: "The value"},
				"value_type":    {Type: genai.TypeString, Description: "text, number, date, or choice"},
				"display_order": {Type: genai.TypeInteger},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			programID, _ := params["program_id"].(string)
			if programID == "" || !isValidUUID(programID) {
				return map[string]any{
					"status":  "error",
					"message": "Invalid program_id. Call get_draft_program to retrieve the correct draft program ID.",
				}, nil
			}
			key, _ := params["key"].(string)
			label, _ := params["label"].(string)
			value, _ := params["value"].(string)
			valueType, _ := params["value_type"].(string)
			if valueType == "" {
				valueType = "text"
			}
			displayOrder := intFromAny(params["display_order"], 0)
			criterion := models.SaveCriterionInput{
				Key:          key,
				Label:        label,
				Value:        value,
				ValueType:    valueType,
				DisplayOrder: displayOrder,
			}
			_, err := programSvc.UpsertCriteria(ctx, programID, userID, []models.SaveCriterionInput{criterion})
			if err != nil {
				return nil, err
			}
			return map[string]string{"status": "saved"}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "save_draft_phase",
		Modes:       []chat.Mode{chat.ModeProgramCreation},
		Description: "Save a single phase to the draft proposal. Call once per phase (e.g. Base, Build, Peak, Taper). Each phase has a template_week that repeats for duration_weeks. Call propose_program after all phases are saved.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Required:   []string{"name", "order_index", "duration_weeks", "template_week"},
			Properties: phaseSchema(),
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			phase, err := parsePhaseParams(params)
			if err != nil {
				return nil, err
			}
			count := proposals.AddPhase(userID, phase)
			return map[string]any{
				"status":      "phase_saved",
				"phase_name":  phase.Name,
				"phase_count": count,
				"message":     fmt.Sprintf("Phase '%s' saved (%d total). Continue with next phase or call propose_program when all phases are ready.", phase.Name, count),
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "update_draft_phase",
		Modes:       []chat.Mode{chat.ModeProgramCreation},
		Description: "Replace a previously saved draft phase by its order_index. Use when the user requests changes to a phase before the program is proposed.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Required:   []string{"name", "order_index", "duration_weeks", "template_week"},
			Properties: phaseSchema(),
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			phase, err := parsePhaseParams(params)
			if err != nil {
				return nil, err
			}
			if err := proposals.UpdatePhase(userID, phase.OrderIndex, phase); err != nil {
				return nil, err
			}
			return map[string]any{
				"status":     "phase_updated",
				"phase_name": phase.Name,
				"message":    fmt.Sprintf("Phase '%s' (order_index %d) updated.", phase.Name, phase.OrderIndex),
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "delete_draft_phase",
		Modes:       []chat.Mode{chat.ModeProgramCreation},
		Description: "Remove a previously saved draft phase by its order_index. Use when the user wants to drop a phase or start over before proposing.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"order_index"},
			Properties: map[string]*genai.Schema{
				"order_index": {Type: genai.TypeInteger, Description: "0-based order_index of the phase to remove"},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			orderIndex := intFromAny(params["order_index"], -1)
			if orderIndex < 0 {
				return nil, fmt.Errorf("order_index is required")
			}
			remaining, err := proposals.DeletePhase(userID, orderIndex)
			if err != nil {
				return nil, err
			}
			return map[string]any{
				"status":      "phase_deleted",
				"phase_count": remaining,
				"message":     fmt.Sprintf("Phase at order_index %d removed. %d phase(s) remaining.", orderIndex, remaining),
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "propose_program",
		Modes:       []chat.Mode{chat.ModeProgramCreation},
		Description: "Assemble and present the program proposal from phases saved via save_draft_phase. Call save_draft_phase for each phase FIRST, then call this with program metadata and criteria. The full proposal is sent to the user for review.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"program", "criteria"},
			Properties: map[string]*genai.Schema{
				"draft_program_id": {Type: genai.TypeString, Description: "ID of the draft program to promote to active on save"},
				"program": {
					Type:        genai.TypeObject,
					Description: "Program metadata (phases are loaded from save_draft_phase calls)",
					Required:    []string{"name", "start_date"},
					Properties: map[string]*genai.Schema{
						"name":             {Type: genai.TypeString, Description: "Program name"},
						"sport":            {Type: genai.TypeString, Description: "Sport or activity"},
						"goal_description": {Type: genai.TypeString, Description: "Goal description"},
						"start_date":       {Type: genai.TypeString, Description: "Start date (YYYY-MM-DD)"},
						"end_date":         {Type: genai.TypeString, Description: "End date (YYYY-MM-DD)"},
					},
				},
				"criteria": {
					Type:        genai.TypeArray,
					Description: "Program criteria gathered from the user",
					Items: &genai.Schema{
						Type:     genai.TypeObject,
						Required: []string{"key", "label", "value"},
						Properties: map[string]*genai.Schema{
							"key":           {Type: genai.TypeString, Description: "Criterion key (e.g. sport, experience_level)"},
							"label":         {Type: genai.TypeString, Description: "Human-readable label"},
							"value":         {Type: genai.TypeString, Description: "The value"},
							"value_type":    {Type: genai.TypeString, Description: "text, number, date, or choice"},
							"display_order": {Type: genai.TypeInteger},
						},
					},
				},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			// Get accumulated phases from save_draft_phase calls.
			existing, _ := proposals.Get(userID)
			var draftPhases []models.TemplatePhaseInput
			if existing != nil {
				draftPhases = existing.DraftPhases
			}
			if len(draftPhases) == 0 {
				return nil, fmt.Errorf("no phases saved — call save_draft_phase for each phase before calling propose_program")
			}

			// Assemble full program: metadata + accumulated phases.
			programMeta, _ := params["program"].(map[string]any)
			if programMeta == nil {
				return nil, fmt.Errorf("program metadata is required")
			}
			programMeta["phases"] = draftPhases

			programJSON, err := json.Marshal(programMeta)
			if err != nil {
				return nil, fmt.Errorf("marshal program: %w", err)
			}
			criteriaJSON, err := json.Marshal(params["criteria"])
			if err != nil {
				return nil, fmt.Errorf("marshal criteria: %w", err)
			}

			draftProgramID, _ := params["draft_program_id"].(string)

			proposals.Set(userID, &PendingProposal{
				Type:           "program_creation",
				Program:        programJSON,
				Criteria:       criteriaJSON,
				DraftProgramID: draftProgramID,
			})

			return map[string]any{
				"status":  "proposal_ready",
				"phases":  len(draftPhases),
				"message": "The program proposal has been sent to the user for review. Wait for their response.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "confirm_program_save",
		Modes:       []chat.Mode{chat.ModeProgramCreation},
		Description: "Save the previously proposed program after the user has accepted it. Only call this after the user explicitly accepts the proposal. Template weeks are automatically expanded into individual weeks.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			// No CanCreateProgram check here — SaveProgramWithCriteria archives
			// the existing active program first, so this always results in at most
			// 1 active program regardless of tier.

			proposal, ok := proposals.Get(userID)
			if !ok {
				return nil, fmt.Errorf("no pending proposal found — you must call propose_program first with the full program structure, then wait for the user to accept before calling confirm_program_save")
			}
			defer proposals.Delete(userID)

			var tmpl models.TemplateProgramInput
			if err := json.Unmarshal(proposal.Program, &tmpl); err != nil {
				return nil, fmt.Errorf("unmarshal template program: %w", err)
			}
			programInput := models.ExpandTemplatesToSaveInput(tmpl)

			var criteriaInput []models.SaveCriterionInput
			if err := json.Unmarshal(proposal.Criteria, &criteriaInput); err != nil {
				return nil, fmt.Errorf("unmarshal criteria: %w", err)
			}

			result, err := programSvc.SaveProgramWithCriteria(ctx, userID, programInput, criteriaInput, proposal.DraftProgramID)
			if err != nil {
				return nil, fmt.Errorf("save program: %w", err)
			}
			return map[string]any{
				"status":     "saved",
				"program_id": result.ID,
				"message":    "Program saved successfully",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "edit_program",
		Modes:       []chat.Mode{chat.ModeProgramManagement},
		Description: "Propose edits to the user's saved program. Supports: updating activities (by ID or across weeks), removing activities (by ID or across weeks), adding activities (to a specific week or across weeks), swapping days, and updating program criteria. The user will review and approve before changes are applied.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"program_id", "description", "edits"},
			Properties: map[string]*genai.Schema{
				"program_id":  {Type: genai.TypeString, Description: "The active program's ID"},
				"description": {Type: genai.TypeString, Description: "Human-readable summary of the changes"},
				"edits": {
					Type:        genai.TypeArray,
					Description: "List of edit actions to apply together",
					Items: &genai.Schema{
						Type:     genai.TypeObject,
						Required: []string{"action"},
						Properties: map[string]*genai.Schema{
							"action": {
								Type:        genai.TypeString,
								Description: "Edit type",
								Enum:        []string{"update_activity", "remove_activity", "add_activity", "swap_day", "update_criteria"},
							},
							"activity_id":         {Type: genai.TypeString, Description: "Target a specific activity by ID (update_activity, remove_activity)"},
							"week_id":             {Type: genai.TypeString, Description: "Target a specific week (add_activity to one week only)"},
							"day_of_week":         {Type: genai.TypeInteger, Description: "0=Sunday, 1=Monday, ..., 6=Saturday"},
							"new_day":             {Type: genai.TypeInteger, Description: "For swap_day: the other day to swap with"},
							"activity_type":       {Type: genai.TypeString, Description: "Activity type (add_activity, update_activity)", Enum: ActivityTypes},
							"prescription":        {Type: genai.TypeObject, Description: "Prescription details"},
							"notes":               {Type: genai.TypeString, Description: "Notes for the activity"},
							"phase_index":         {Type: genai.TypeInteger, Description: "0-based phase index. Omit to apply to all phases."},
							"activity_type_filter": {Type: genai.TypeString, Description: "Filter by activity type when multiple exist on the same day", Enum: ActivityTypes},
							"criteria": {
								Type:        genai.TypeArray,
								Description: "For update_criteria action",
								Items: &genai.Schema{
									Type:     genai.TypeObject,
									Required: []string{"key", "label", "value"},
									Properties: map[string]*genai.Schema{
										"key":           {Type: genai.TypeString},
										"label":         {Type: genai.TypeString},
										"value":         {Type: genai.TypeString},
										"value_type":    {Type: genai.TypeString},
										"display_order": {Type: genai.TypeInteger},
									},
								},
							},
						},
					},
				},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			programID, _ := params["program_id"].(string)
			description, _ := params["description"].(string)
			if programID == "" {
				return nil, fmt.Errorf("program_id is required")
			}

			if err := programSvc.VerifyProgramOwnership(ctx, programID, userID); err != nil {
				return nil, fmt.Errorf("invalid program_id: %w", err)
			}

			editsJSON, err := json.Marshal(params["edits"])
			if err != nil {
				return nil, fmt.Errorf("marshal edits: %w", err)
			}

			// Enrich edits with "before" state for frontend diffs.
			var rawEdits []models.ProgramEdit
			if err := json.Unmarshal(editsJSON, &rawEdits); err == nil {
				if enriched, err := programSvc.ResolveEditsBefore(ctx, programID, userID, rawEdits); err == nil {
					editsJSON, _ = json.Marshal(enriched)
				}
			}

			metaJSON, _ := json.Marshal(map[string]string{
				"program_id":  programID,
				"description": description,
			})

			proposals.Set(userID, &PendingProposal{
				Type:     "program_edit",
				Program:  editsJSON,
				Criteria: metaJSON,
			})

			return map[string]any{
				"status":      "proposal_sent",
				"description": description,
				"message":     "Edit proposal sent to user for review. Wait for their response.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "confirm_edit",
		Modes:       []chat.Mode{chat.ModeProgramManagement},
		Description: "Apply the previously proposed program edits after the user has accepted them.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			proposal, ok := proposals.Get(userID)
			if !ok {
				return nil, fmt.Errorf("no pending edit proposal found — call edit_program first, then wait for user to accept")
			}
			if proposal.Type != "program_edit" {
				return nil, fmt.Errorf("pending proposal is not a program edit")
			}
			defer proposals.Delete(userID)

			var meta map[string]string
			if err := json.Unmarshal(proposal.Criteria, &meta); err != nil {
				return nil, fmt.Errorf("unmarshal proposal meta: %w", err)
			}
			programID := meta["program_id"]

			var edits []models.ProgramEdit
			if err := json.Unmarshal(proposal.Program, &edits); err != nil {
				return nil, fmt.Errorf("unmarshal edits: %w", err)
			}

			count, err := programSvc.ApplyEdits(ctx, programID, userID, edits)
			if err != nil {
				return nil, fmt.Errorf("apply edits: %w", err)
			}
			return map[string]any{
				"status":  "applied",
				"count":   count,
				"message": "Program edits applied successfully.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "start_program_today",
		Modes:       []chat.Mode{chat.ModeProgramCreation},
		Description: "Modify the pending program proposal to start from today instead of next Monday. Call this after propose_program and BEFORE confirm_program_save, only when the user explicitly wants to start today. It prepends a partial 'Current Week' phase containing only the activities from today through Sunday, and shifts the program start date to this week's Monday.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"activities_this_week"},
			Properties: map[string]*genai.Schema{
				"activities_this_week": {
					Type:        genai.TypeArray,
					Description: "Activities from today's day_of_week through Sunday (end of current week). Only include days that are today or later.",
					Items: &genai.Schema{
						Type:     genai.TypeObject,
						Required: []string{"day_of_week", "activity_type", "prescription"},
						Properties: map[string]*genai.Schema{
							"day_of_week":   {Type: genai.TypeInteger, Description: "0=Sunday, 1=Monday, ..., 6=Saturday"},
							"activity_type": {Type: genai.TypeString, Enum: ActivityTypes},
							"prescription":  {Type: genai.TypeObject},
							"notes":         {Type: genai.TypeString},
							"order_index":   {Type: genai.TypeInteger},
						},
					},
				},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			proposal, ok := proposals.Get(userID)
			if !ok {
				return nil, fmt.Errorf("no pending proposal found — call propose_program first")
			}

			activitiesRaw, err := json.Marshal(params["activities_this_week"])
			if err != nil {
				return nil, fmt.Errorf("marshal activities: %w", err)
			}
			var partialActivities []models.TemplateActivity
			if err := json.Unmarshal(activitiesRaw, &partialActivities); err != nil {
				return nil, fmt.Errorf("unmarshal activities: %w", err)
			}

			var program models.TemplateProgramInput
			if err := json.Unmarshal(proposal.Program, &program); err != nil {
				return nil, fmt.Errorf("unmarshal program: %w", err)
			}

			now := time.Now()
			thisMonday := models.MondayOf(now)
			thisMondayStr := thisMonday.Format("2006-01-02")
			nextMondayStr := thisMonday.AddDate(0, 0, 7).Format("2006-01-02")

			partialPhase := models.TemplatePhaseInput{
				Name:          "Current Week",
				OrderIndex:    0,
				StartDate:     thisMondayStr,
				EndDate:       thisMonday.AddDate(0, 0, 6).Format("2006-01-02"),
				DurationWeeks: 1,
				TemplateWeek:  models.TemplateWeek{Activities: partialActivities},
			}

			for i := range program.Phases {
				program.Phases[i].OrderIndex++
				if program.Phases[i].StartDate == program.StartDate {
					program.Phases[i].StartDate = nextMondayStr
				}
			}

			program.Phases = append([]models.TemplatePhaseInput{partialPhase}, program.Phases...)
			program.StartDate = thisMondayStr

			modifiedJSON, err := json.Marshal(program)
			if err != nil {
				return nil, fmt.Errorf("marshal modified program: %w", err)
			}
			proposal.Program = modifiedJSON
			proposals.Set(userID, proposal)

			return map[string]any{
				"status":     "updated",
				"start_date": thisMonday.Format("2006-01-02"),
				"message":    "Program updated to start this week. A partial first week has been added with today's remaining activities. Call confirm_program_save to finalize.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "set_weekly_effort_goal",
		Modes:       []chat.Mode{chat.ModeGeneralCoaching, chat.ModeProgramCreation},
		Description: "Set the user's weekly effort goal. Use this when creating or modifying a training program to align the effort target with the program's training load.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"goal"},
			Properties: map[string]*genai.Schema{
				"goal": {Type: genai.TypeInteger, Description: "The weekly effort goal (positive integer)"},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			goalFloat, ok := params["goal"].(float64)
			if !ok || goalFloat <= 0 {
				return nil, fmt.Errorf("goal must be a positive integer")
			}
			goal := int(goalFloat)
			updated, err := userSvc.Update(ctx, userID, services.UpdateUserInput{WeeklyEffortGoal: &goal})
			if err != nil {
				return nil, fmt.Errorf("update weekly effort goal: %w", err)
			}
			return map[string]any{
				"status":             "updated",
				"weekly_effort_goal": updated.WeeklyEffortGoal,
				"message":            fmt.Sprintf("Weekly effort goal set to %d", updated.WeeklyEffortGoal),
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "begin_program_creation",
		Modes:       []chat.Mode{chat.ModeGeneralCoaching, chat.ModeWorkoutReview},
		Description: "Switch to program creation mode. Call this when the user wants to create a new training program, build a plan, or start training for an event. This loads the full program creation workflow with all required tools.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		// Handler is intentionally nil: this tool is intercepted by the chat handler
		// before reaching the registry. It triggers a mode escalation to program_creation.
		Handler: nil,
	})

	reg.Register(&Tool{
		Name:        "begin_program_modification",
		Modes:       []chat.Mode{chat.ModeGeneralCoaching, chat.ModeWorkoutReview},
		Description: "Switch to program modification mode. Call this when the user wants to edit, adjust, or change their current training program. This loads the program editing tools.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		// Handler is intentionally nil: this tool is intercepted by the chat handler
		// before reaching the registry. It triggers a mode escalation to program_management.
		Handler: nil,
	})

	reg.Register(&Tool{
		Name:        "get_scheduled_activity",
		Modes:       []chat.Mode{chat.ModeProgramManagement, chat.ModeWorkoutReview},
		Description: "Get details of a specific scheduled activity including its week and phase context",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"activity_id"},
			Properties: map[string]*genai.Schema{
				"activity_id": {Type: genai.TypeString},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			activityID, _ := params["activity_id"].(string)
			if activityID == "" {
				return nil, fmt.Errorf("activity_id is required")
			}
			return programSvc.GetScheduledActivity(ctx, activityID, userID)
		},
	})
}
