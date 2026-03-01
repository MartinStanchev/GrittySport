package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grittyfitness/api/internal/ai"
	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
	"google.golang.org/genai"
)

// applyTemplateModifications applies targeted modifications to template_week activities
// within the template-based proposal format.
func applyTemplateModifications(programJSON json.RawMessage, modificationsRaw any) (json.RawMessage, error) {
	var program map[string]any
	if err := json.Unmarshal(programJSON, &program); err != nil {
		return nil, fmt.Errorf("unmarshal program: %w", err)
	}

	modsJSON, err := json.Marshal(modificationsRaw)
	if err != nil {
		return nil, fmt.Errorf("marshal modifications: %w", err)
	}

	var mods []map[string]any
	if err := json.Unmarshal(modsJSON, &mods); err != nil {
		return nil, fmt.Errorf("unmarshal modifications: %w", err)
	}

	phases, _ := program["phases"].([]any)

	for _, mod := range mods {
		action, _ := mod["action"].(string)
		phaseIdx := intFromAny(mod["phase_index"], -1)
		dayOfWeek := intFromAny(mod["day_of_week"], -1)

		for pi, p := range phases {
			if phaseIdx >= 0 && pi != phaseIdx {
				continue
			}
			phase, _ := p.(map[string]any)
			tw, _ := phase["template_week"].(map[string]any)
			if tw == nil {
				continue
			}
			activities, _ := tw["activities"].([]any)

			switch action {
			case "swap_day":
				newDay := intFromAny(mod["new_day"], -1)
				if dayOfWeek < 0 || newDay < 0 {
					continue
				}
				for i, a := range activities {
					act, _ := a.(map[string]any)
					d := intFromAny(act["day_of_week"], -1)
					if d == dayOfWeek {
						act["day_of_week"] = float64(newDay)
					} else if d == newDay {
						act["day_of_week"] = float64(dayOfWeek)
					}
					activities[i] = act
				}

			case "change_activity":
				newType, _ := mod["activity_type"].(string)
				newPrescription := mod["prescription"]
				notes, _ := mod["notes"].(string)
				typeFilter, _ := mod["activity_type_filter"].(string)
				for i, a := range activities {
					act, _ := a.(map[string]any)
					if intFromAny(act["day_of_week"], -1) != dayOfWeek {
						continue
					}
					if typeFilter != "" {
						if actType, _ := act["activity_type"].(string); actType != typeFilter {
							continue
						}
					}
					if newType != "" {
						act["activity_type"] = newType
					}
					if newPrescription != nil {
						act["prescription"] = newPrescription
					}
					if notes != "" {
						act["notes"] = notes
					}
					activities[i] = act
				}

			case "update_prescription":
				newPrescription := mod["prescription"]
				if newPrescription == nil {
					continue
				}
				for i, a := range activities {
					act, _ := a.(map[string]any)
					if intFromAny(act["day_of_week"], -1) == dayOfWeek {
						act["prescription"] = newPrescription
						activities[i] = act
					}
				}

			case "remove_activity":
				typeFilter, _ := mod["activity_type_filter"].(string)
				filtered := make([]any, 0, len(activities))
				for _, a := range activities {
					act, _ := a.(map[string]any)
					d := intFromAny(act["day_of_week"], -1)
					if d == dayOfWeek {
						if typeFilter != "" {
							if actType, _ := act["activity_type"].(string); actType != typeFilter {
								filtered = append(filtered, act)
								continue
							}
						}
						continue
					}
					filtered = append(filtered, act)
				}
				activities = filtered

			case "add_activity":
				actType, _ := mod["activity_type"].(string)
				prescription := mod["prescription"]
				notes, _ := mod["notes"].(string)
				newAct := map[string]any{
					"day_of_week":   float64(dayOfWeek),
					"activity_type": actType,
					"prescription":  prescription,
				}
				if notes != "" {
					newAct["notes"] = notes
				}
				activities = append(activities, newAct)
			}

			tw["activities"] = activities
			phase["template_week"] = tw
			phases[pi] = phase
		}
	}

	program["phases"] = phases
	return json.Marshal(program)
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

func RegisterAllTools(reg *Registry, programSvc *services.ProgramService, userSvc *services.UserService, proposals *ProposalStore, skillLoader *ai.SkillLoader) {
	reg.Register(&Tool{
		Name:        "read_skill",
		Description: "Load sport-specific training knowledge for exercise selection, periodization, and pacing. Use when creating or modifying programs to get domain expertise.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"skill_name"},
			Properties: map[string]*genai.Schema{
				"skill_name": {
					Type:        genai.TypeString,
					Description: "The sport or training domain to load knowledge for",
					Enum:        []string{"running", "cycling", "swimming", "strength_training", "periodization", "mobility_recovery"},
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
			return programSvc.GetCriteria(ctx, programID)
		},
	})

	reg.Register(&Tool{
		Name:        "get_draft_program",
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
			if programID == "" {
				return nil, fmt.Errorf("program_id is required")
			}
			key, _ := params["key"].(string)
			label, _ := params["label"].(string)
			value, _ := params["value"].(string)
			valueType, _ := params["value_type"].(string)
			if valueType == "" {
				valueType = "text"
			}
			displayOrder := 0
			if do, ok := params["display_order"].(float64); ok {
				displayOrder = int(do)
			}
			criterion := models.SaveCriterionInput{
				Key:          key,
				Label:        label,
				Value:        value,
				ValueType:    valueType,
				DisplayOrder: displayOrder,
			}
			_, err := programSvc.UpsertCriteria(ctx, programID, []models.SaveCriterionInput{criterion})
			if err != nil {
				return nil, err
			}
			return map[string]string{"status": "saved"}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "propose_program",
		Description: "Create a complete program proposal with template weeks for user review. Each phase has a single template_week (Mon-Sun pattern) that repeats for duration_weeks. The proposal is sent to the user immediately.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"program", "criteria"},
			Properties: map[string]*genai.Schema{
				"draft_program_id": {Type: genai.TypeString, Description: "Optional: ID of the draft program to promote to active on save"},
				"program": {
					Type:        genai.TypeObject,
					Description: "The program with template weeks per phase",
					Required:    []string{"name", "start_date", "phases"},
					Properties: map[string]*genai.Schema{
						"name":             {Type: genai.TypeString, Description: "Program name"},
						"sport":            {Type: genai.TypeString, Description: "Sport or activity"},
						"goal_description": {Type: genai.TypeString, Description: "Goal description"},
						"start_date":       {Type: genai.TypeString, Description: "Start date (YYYY-MM-DD)"},
						"end_date":         {Type: genai.TypeString, Description: "End date (YYYY-MM-DD)"},
						"phases": {
							Type:        genai.TypeArray,
							Description: "Phases with template weeks",
							Items: &genai.Schema{
								Type:     genai.TypeObject,
								Required: []string{"name", "order_index", "duration_weeks", "template_week"},
								Properties: map[string]*genai.Schema{
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
														"activity_type": {Type: genai.TypeString, Description: "e.g. Easy Run, Interval Training, Strength, Rest"},
														"prescription":  {Type: genai.TypeObject, Description: "Activity details like distance, pace, sets, reps"},
														"notes":         {Type: genai.TypeString},
														"order_index":   {Type: genai.TypeInteger},
													},
												},
											},
										},
									},
								},
							},
						},
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
			programJSON, err := json.Marshal(params["program"])
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
				"message": "The program proposal has been sent to the user for review. Wait for their response.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "modify_pending_proposal",
		Description: "Apply targeted modifications to the pending program proposal's template weeks. Use this when the user requests changes (e.g., swap rest day, change an activity type). Changes apply to the template, affecting all weeks in the phase.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"modifications"},
			Properties: map[string]*genai.Schema{
				"modifications": {
					Type:        genai.TypeArray,
					Description: "List of targeted modifications to apply to template weeks",
					Items: &genai.Schema{
						Type:     genai.TypeObject,
						Required: []string{"action"},
						Properties: map[string]*genai.Schema{
							"action": {
								Type:        genai.TypeString,
								Description: "Type of modification",
								Enum:        []string{"swap_day", "change_activity", "update_prescription", "remove_activity", "add_activity"},
							},
							"phase_index":   {Type: genai.TypeInteger, Description: "0-based phase index (omit to apply to all phases)"},
							"day_of_week":   {Type: genai.TypeInteger, Description: "Target day (0=Sun, 1=Mon, ..., 6=Sat)"},
							"new_day":       {Type: genai.TypeInteger, Description: "New day for swap_day action"},
							"activity_type": {Type: genai.TypeString, Description: "New activity type for change_activity/add_activity"},
							"prescription":  {Type: genai.TypeObject, Description: "New prescription for update_prescription/add_activity"},
							"notes":                {Type: genai.TypeString, Description: "Notes for the activity"},
							"activity_type_filter": {Type: genai.TypeString, Description: "Only modify activities matching this type when multiple exist on the same day"},
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

			modified, err := applyTemplateModifications(proposal.Program, params["modifications"])
			if err != nil {
				return nil, fmt.Errorf("apply modifications: %w", err)
			}

			proposal.Program = modified
			proposals.Set(userID, proposal)

			return map[string]any{
				"status":  "proposal_modified",
				"message": "The modifications have been applied. The updated proposal has been sent to the user for review.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "confirm_program_save",
		Description: "Save the previously proposed program after the user has accepted it. Only call this after the user explicitly accepts the proposal. Template weeks are automatically expanded into individual weeks.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
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
		Name:        "propose_adjustment",
		Description: "Propose adjustments to scheduled activities in the user's program. The user will review and accept or request changes.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"adjustments"},
			Properties: map[string]*genai.Schema{
				"adjustments": {
					Type: genai.TypeArray,
					Items: &genai.Schema{
						Type:     genai.TypeObject,
						Required: []string{"activity_id", "prescription"},
						Properties: map[string]*genai.Schema{
							"activity_id":  {Type: genai.TypeString},
							"prescription": {Type: genai.TypeObject, Description: "Updated prescription details"},
						},
					},
				},
			},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			adjustmentsJSON, err := json.Marshal(params["adjustments"])
			if err != nil {
				return nil, fmt.Errorf("marshal adjustments: %w", err)
			}

			proposals.Set(userID, &PendingProposal{
				Type:    "program_adjustment",
				Program: adjustmentsJSON,
			})

			return map[string]any{
				"status":  "proposal_sent",
				"message": "The adjustment proposal has been sent to the user for review. Wait for their response.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "confirm_adjustment",
		Description: "Apply the previously proposed adjustments after the user has accepted them.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			proposal, ok := proposals.Get(userID)
			if !ok {
				return nil, fmt.Errorf("no pending adjustment proposal found")
			}
			defer proposals.Delete(userID)

			var adjustments []models.AdjustActivityInput
			if err := json.Unmarshal(proposal.Program, &adjustments); err != nil {
				return nil, fmt.Errorf("unmarshal adjustments: %w", err)
			}

			result, err := programSvc.AdjustActivities(ctx, adjustments)
			if err != nil {
				return nil, fmt.Errorf("adjust activities: %w", err)
			}
			return map[string]any{
				"status":   "adjusted",
				"count":    len(result),
				"message":  "Activities adjusted successfully",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "propose_program_modification",
		Description: "Propose structural modifications to the user's saved program. These changes affect all weeks (or specific phases). Use this for: moving activities between days (swap_day), changing activity types (change_activity), adding new recurring activities (add_activity), or removing activities from a day (remove_activity). The user will review and approve before changes are applied.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"program_id", "description", "modifications"},
			Properties: map[string]*genai.Schema{
				"program_id":  {Type: genai.TypeString, Description: "The ID of the active program"},
				"description": {Type: genai.TypeString, Description: "Human-readable summary of the changes, e.g. 'Moving rest days to Wednesday and Monday'"},
				"modifications": {
					Type: genai.TypeArray,
					Items: &genai.Schema{
						Type:     genai.TypeObject,
						Required: []string{"action", "day_of_week"},
						Properties: map[string]*genai.Schema{
							"action": {
								Type:        genai.TypeString,
								Description: "One of: swap_day, change_activity, add_activity, remove_activity",
								Enum:        []string{"swap_day", "change_activity", "add_activity", "remove_activity"},
							},
							"day_of_week": {
								Type:        genai.TypeInteger,
								Description: "Day to modify (1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 0=Sunday)",
							},
							"new_day": {
								Type:        genai.TypeInteger,
								Description: "For swap_day: the other day to swap with",
							},
							"activity_type": {
								Type:        genai.TypeString,
								Description: "For add_activity or change_activity: the activity type",
							},
							"prescription": {
								Type:        genai.TypeObject,
								Description: "For add_activity or change_activity: the prescription details",
							},
							"notes": {
								Type:        genai.TypeString,
								Description: "Optional notes for the activity",
							},
							"phase_index": {
								Type:        genai.TypeInteger,
								Description: "0-based phase index to limit changes to a specific phase. Omit to apply to all phases.",
							},
							"activity_type_filter": {
								Type:        genai.TypeString,
								Description: "Only modify activities matching this type (e.g. 'Strength Training'). Required when multiple activities exist on the same day.",
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

			modsJSON, err := json.Marshal(params["modifications"])
			if err != nil {
				return nil, fmt.Errorf("marshal modifications: %w", err)
			}

			metaJSON, _ := json.Marshal(map[string]string{
				"program_id":  programID,
				"description": description,
			})

			proposals.Set(userID, &PendingProposal{
				Type:     "program_modification",
				Program:  modsJSON,
				Criteria: metaJSON,
			})

			return map[string]any{
				"status":      "proposal_sent",
				"description": description,
				"message":     "Modification proposal sent to user for review. Wait for their response.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "confirm_program_modification",
		Description: "Apply the previously proposed program modifications after the user has accepted them.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			proposal, ok := proposals.Get(userID)
			if !ok {
				return nil, fmt.Errorf("no pending modification proposal found — call propose_program_modification first, then wait for user to accept")
			}
			if proposal.Type != "program_modification" {
				return nil, fmt.Errorf("pending proposal is not a program modification")
			}
			defer proposals.Delete(userID)

			var meta map[string]string
			if err := json.Unmarshal(proposal.Criteria, &meta); err != nil {
				return nil, fmt.Errorf("unmarshal proposal meta: %w", err)
			}
			programID := meta["program_id"]

			var mods []models.ProgramModificationAction
			if err := json.Unmarshal(proposal.Program, &mods); err != nil {
				return nil, fmt.Errorf("unmarshal modifications: %w", err)
			}

			count, err := programSvc.ModifyProgram(ctx, programID, userID, mods)
			if err != nil {
				return nil, fmt.Errorf("apply modifications: %w", err)
			}
			return map[string]any{
				"status":  "applied",
				"count":   count,
				"message": "Program modifications applied successfully across all weeks.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "update_program_criteria",
		Description: "Update program criteria/settings directly",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"program_id", "criteria"},
			Properties: map[string]*genai.Schema{
				"program_id": {Type: genai.TypeString},
				"criteria": {
					Type: genai.TypeArray,
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
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			programID, _ := params["program_id"].(string)
			if programID == "" {
				return nil, fmt.Errorf("program_id is required")
			}
			criteriaRaw, err := json.Marshal(params["criteria"])
			if err != nil {
				return nil, err
			}
			var criteria []models.SaveCriterionInput
			if err := json.Unmarshal(criteriaRaw, &criteria); err != nil {
				return nil, err
			}
			return programSvc.UpsertCriteria(ctx, programID, criteria)
		},
	})

	reg.Register(&Tool{
		Name:        "start_program_today",
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
							"activity_type": {Type: genai.TypeString},
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
		Name:        "get_scheduled_activity",
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
			return programSvc.GetScheduledActivity(ctx, activityID)
		},
	})
}
