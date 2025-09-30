import { z } from 'zod';
import type { MessageParam, TextBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources';

// Base agent interface
export interface Agent {
  name: string;
  description: string;
  tools: Tool[];
  execute(input: string): Promise<AgentResponse>;
  getAnthropicTools(): AnthropicTool[];
}

// Tool interface for agent capabilities
export interface Tool {
  name: string;
  description: string;
  schema: z.ZodSchema;
  execute: (params: any) => Promise<any>;
}

// Anthropic tool definition
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Conversation message types
export type ConversationMessage = MessageParam;

export interface ConversationContext {
  messages: ConversationMessage[];
  maxHistory?: number;
}

// Agent response structure
export interface AgentResponse {
  success: boolean;
  result?: any;
  error?: string;
  toolsUsed: string[];
  metadata?: Record<string, any>;
}

// Task planning structures
export interface TaskStep {
  id: string;
  description: string;
  agent: string;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
}

export interface ExecutionPlan {
  id: string;
  description: string;
  steps: TaskStep[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// File operation schemas
export const FileReadSchema = z.object({
  path: z.string(),
  encoding: z.string().optional().default('utf8')
});

export const FileWriteSchema = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.string().optional().default('utf8')
});

export const FileAnalyzeSchema = z.object({
  path: z.string(),
  analysisType: z.enum(['structure', 'content', 'metadata', 'all']).default('all')
});

// Web research schemas
export const WebScrapeSchema = z.object({
  url: z.string().url(),
  selector: z.string().optional(),
  extractType: z.enum(['text', 'html', 'links', 'images']).default('text')
});

export const WebSearchSchema = z.object({
  query: z.string(),
  maxResults: z.number().min(1).max(20).default(10),
  source: z.enum(['duckduckgo', 'custom']).default('duckduckgo')
});

// Code analysis schemas
export const CodeAnalyzeSchema = z.object({
  path: z.string(),
  language: z.string().optional(),
  analysisType: z.enum(['structure', 'complexity', 'dependencies', 'security', 'all']).default('all')
});

export const CodeSuggestionSchema = z.object({
  code: z.string(),
  language: z.string(),
  focusArea: z.enum(['performance', 'readability', 'security', 'best-practices']).default('all')
});

// Data processing schemas
export const CsvProcessSchema = z.object({
  filePath: z.string(),
  operation: z.enum(['read', 'transform', 'analyze']),
  transformConfig: z.object({
    columns: z.array(z.string()).optional(),
    filters: z.record(z.any()).optional(),
    aggregations: z.record(z.string()).optional()
  }).optional()
});

export const JsonProcessSchema = z.object({
  data: z.union([z.string(), z.record(z.any())]),
  operation: z.enum(['parse', 'transform', 'validate', 'query']),
  schema: z.any().optional(),
  query: z.string().optional()
});

// Task planning schemas
export const TaskPlanSchema = z.object({
  objective: z.string(),
  context: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  maxSteps: z.number().min(1).max(50).default(10)
});

export const ExecuteTaskSchema = z.object({
  planId: z.string(),
  stepId: z.string().optional()
});

export type FileReadInput = z.infer<typeof FileReadSchema>;
export type FileWriteInput = z.infer<typeof FileWriteSchema>;
export type FileAnalyzeInput = z.infer<typeof FileAnalyzeSchema>;
export type WebScrapeInput = z.infer<typeof WebScrapeSchema>;
export type WebSearchInput = z.infer<typeof WebSearchSchema>;
export type CodeAnalyzeInput = z.infer<typeof CodeAnalyzeSchema>;
export type CodeSuggestionInput = z.infer<typeof CodeSuggestionSchema>;
export type CsvProcessInput = z.infer<typeof CsvProcessSchema>;
export type JsonProcessInput = z.infer<typeof JsonProcessSchema>;
export type TaskPlanInput = z.infer<typeof TaskPlanSchema>;
export type ExecuteTaskInput = z.infer<typeof ExecuteTaskSchema>;