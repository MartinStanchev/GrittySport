package tools

import (
	"context"
	"fmt"

	"github.com/grittyfitness/api/internal/chat"
	"google.golang.org/genai"
)

type ToolFunc func(ctx context.Context, userID string, params map[string]any) (any, error)

type Tool struct {
	Name        string
	Description string
	Parameters  *genai.Schema
	Handler     ToolFunc
	Modes       []chat.Mode
}

type Registry struct {
	tools map[string]*Tool
	order []string
}

func NewRegistry() *Registry {
	return &Registry{
		tools: make(map[string]*Tool),
	}
}

func (r *Registry) Register(tool *Tool) {
	r.tools[tool.Name] = tool
	r.order = append(r.order, tool.Name)
}

func (r *Registry) Get(name string) (*Tool, bool) {
	t, ok := r.tools[name]
	return t, ok
}

func (r *Registry) Execute(ctx context.Context, name string, userID string, params map[string]any) (any, error) {
	tool, ok := r.tools[name]
	if !ok {
		return nil, fmt.Errorf("unknown tool: %s", name)
	}
	return tool.Handler(ctx, userID, params)
}

func (r *Registry) GeminiTools() []*genai.Tool {
	return r.geminiToolsFromNames(r.order)
}

// GeminiToolsForMode returns only the tools tagged for the given conversation mode.
// Falls back to all tools if no tools match the mode.
func (r *Registry) GeminiToolsForMode(mode chat.Mode) []*genai.Tool {
	var matched []string
	for _, name := range r.order {
		if toolHasMode(r.tools[name], mode) {
			matched = append(matched, name)
		}
	}
	if len(matched) == 0 {
		return r.geminiToolsFromNames(r.order)
	}
	return r.geminiToolsFromNames(matched)
}

func (r *Registry) geminiToolsFromNames(names []string) []*genai.Tool {
	declarations := make([]*genai.FunctionDeclaration, 0, len(names))
	for _, name := range names {
		tool := r.tools[name]
		declarations = append(declarations, &genai.FunctionDeclaration{
			Name:        tool.Name,
			Description: tool.Description,
			Parameters:  tool.Parameters,
		})
	}
	return []*genai.Tool{{FunctionDeclarations: declarations}}
}

// TotalToolCount returns the number of registered tools.
func (r *Registry) TotalToolCount() int {
	return len(r.order)
}

// Exists returns true if a tool with the given name is registered.
func (r *Registry) Exists(name string) bool {
	_, ok := r.tools[name]
	return ok
}

// ToolInMode returns true if the named tool exists and is tagged for the given mode.
func (r *Registry) ToolInMode(name string, mode chat.Mode) bool {
	tool, ok := r.tools[name]
	if !ok {
		return false
	}
	return toolHasMode(tool, mode)
}

// ModeForTool returns the best escalation target mode for the named tool.
// When a tool belongs to multiple modes, the mode with fewer total tools wins.
func (r *Registry) ModeForTool(name string) (chat.Mode, bool) {
	tool, ok := r.tools[name]
	if !ok || len(tool.Modes) == 0 {
		return "", false
	}
	if len(tool.Modes) == 1 {
		return tool.Modes[0], true
	}
	best := tool.Modes[0]
	bestCount := r.countToolsForMode(best)
	for _, m := range tool.Modes[1:] {
		if c := r.countToolsForMode(m); c < bestCount {
			best = m
			bestCount = c
		}
	}
	return best, true
}

func (r *Registry) countToolsForMode(mode chat.Mode) int {
	count := 0
	for _, name := range r.order {
		if toolHasMode(r.tools[name], mode) {
			count++
		}
	}
	return count
}

func toolHasMode(t *Tool, mode chat.Mode) bool {
	for _, m := range t.Modes {
		if m == mode {
			return true
		}
	}
	return false
}
