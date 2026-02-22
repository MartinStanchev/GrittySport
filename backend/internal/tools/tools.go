package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grittyfitness/api/internal/models"
	"github.com/grittyfitness/api/internal/services"
	"google.golang.org/genai"
)

func RegisterAllTools(reg *Registry, programSvc *services.ProgramService, userSvc *services.UserService, proposals *ProposalStore) {
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
		Description: "Propose a new training program for the user to review. The user will see a preview and can accept or request changes. Do NOT call this until you have gathered enough information from the user. Always call this BEFORE confirm_program_save.",
		Parameters: &genai.Schema{
			Type:     genai.TypeObject,
			Required: []string{"program", "criteria"},
			Properties: map[string]*genai.Schema{
				"draft_program_id": {Type: genai.TypeString, Description: "Optional: ID of the draft program to promote to active on save"},
				"program": {
					Type:        genai.TypeObject,
					Description: "The program structure",
					Required:    []string{"name", "start_date", "phases"},
					Properties: map[string]*genai.Schema{
						"name":             {Type: genai.TypeString, Description: "Program name"},
						"sport":            {Type: genai.TypeString, Description: "Sport or activity"},
						"goal_description": {Type: genai.TypeString, Description: "Goal description"},
						"start_date":       {Type: genai.TypeString, Description: "Start date (YYYY-MM-DD)"},
						"end_date":         {Type: genai.TypeString, Description: "End date (YYYY-MM-DD)"},
						"phases": {
							Type:        genai.TypeArray,
							Description: "Program phases",
							Items: &genai.Schema{
								Type:     genai.TypeObject,
								Required: []string{"name", "order_index", "weeks"},
								Properties: map[string]*genai.Schema{
									"name":        {Type: genai.TypeString},
									"order_index": {Type: genai.TypeInteger},
									"start_date":  {Type: genai.TypeString},
									"end_date":    {Type: genai.TypeString},
									"weeks": {
										Type: genai.TypeArray,
										Items: &genai.Schema{
											Type:     genai.TypeObject,
											Required: []string{"week_number", "activities"},
											Properties: map[string]*genai.Schema{
												"week_number": {Type: genai.TypeInteger},
												"start_date":  {Type: genai.TypeString},
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
				"status":  "proposal_sent",
				"message": "The program proposal has been sent to the user for review. Wait for their response before proceeding.",
			}, nil
		},
	})

	reg.Register(&Tool{
		Name:        "confirm_program_save",
		Description: "Save the previously proposed program after the user has accepted it. Only call this after the user explicitly accepts the proposal.",
		Parameters: &genai.Schema{
			Type:       genai.TypeObject,
			Properties: map[string]*genai.Schema{},
		},
		Handler: func(ctx context.Context, userID string, params map[string]any) (any, error) {
			proposal, ok := proposals.Get(userID)
			if !ok {
				return nil, fmt.Errorf("no pending proposal found")
			}
			defer proposals.Delete(userID)

			var programInput models.SaveProgramInput
			if err := json.Unmarshal(proposal.Program, &programInput); err != nil {
				return nil, fmt.Errorf("unmarshal program: %w", err)
			}
			var criteriaInput []models.SaveCriterionInput
			if err := json.Unmarshal(proposal.Criteria, &criteriaInput); err != nil {
				return nil, fmt.Errorf("unmarshal criteria: %w", err)
			}

			result, saveErr := programSvc.SaveProgramWithCriteria(ctx, userID, programInput, criteriaInput, proposal.DraftProgramID)
			if saveErr != nil {
				return nil, fmt.Errorf("save program: %w", saveErr)
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
