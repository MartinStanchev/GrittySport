package tools

import (
	"context"
	"fmt"

	"google.golang.org/genai"
)

type ToolFunc func(ctx context.Context, userID string, params map[string]any) (any, error)

type Tool struct {
	Name        string
	Description string
	Parameters  *genai.Schema
	Handler     ToolFunc
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
	var declarations []*genai.FunctionDeclaration
	for _, name := range r.order {
		tool := r.tools[name]
		declarations = append(declarations, &genai.FunctionDeclaration{
			Name:        tool.Name,
			Description: tool.Description,
			Parameters:  tool.Parameters,
		})
	}
	return []*genai.Tool{{FunctionDeclarations: declarations}}
}
