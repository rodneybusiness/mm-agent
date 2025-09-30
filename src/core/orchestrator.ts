import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, TextBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources';
import { Agent, AgentResponse, ConversationContext, AnthropicTool } from '../types';
import { FileManagementAgent } from '../agents/fileAgent';
import { WebResearchAgent } from '../agents/webAgent';
import { CodeAnalysisAgent } from '../agents/codeAgent';
import { TaskPlanningAgent } from '../agents/taskAgent';
import { DataProcessingAgent } from '../agents/dataAgent';
import { Logger } from './logger';
import { EventEmitter, ToolEvent, SessionEvent } from './event-emitter';
import { AnalyticsEngine } from './analytics';

export interface OrchestratorConfig {
  anthropicApiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  enableLogging?: boolean;
  enableAnalytics?: boolean;
  analyticsDbPath?: string;
}

export class AgentOrchestrator {
  private agents = new Map<string, Agent>();
  private claudeClient: Anthropic;
  private logger: Logger;
  private config: Required<OrchestratorConfig>;
  private conversationHistory: Map<string, ConversationContext> = new Map();
  public events: EventEmitter;
  private analytics?: AnalyticsEngine;
  
  constructor(config: OrchestratorConfig) {
    this.config = {
      anthropicApiKey: config.anthropicApiKey,
      model: config.model || 'claude-sonnet-4-20250514',
      maxTokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.7,
      enableLogging: config.enableLogging ?? true,
      enableAnalytics: config.enableAnalytics ?? true,
      analyticsDbPath: config.analyticsDbPath
    };

    this.claudeClient = new Anthropic({ apiKey: this.config.anthropicApiKey });
    this.logger = new Logger(this.config.enableLogging);
    this.events = new EventEmitter();
    
    if (this.config.enableAnalytics) {
      this.analytics = new AnalyticsEngine(this.config.analyticsDbPath);
      this.setupAnalyticsListeners();
    }
    
    this.initializeAgents();
    this.logger.info('Agent Orchestrator initialized with all agents');
  }
  
  private setupAnalyticsListeners(): void {
    if (!this.analytics) return;
    
    this.events.on('tool_complete', async (event: ToolEvent) => {
      await this.analytics!.recordToolExecution({
        sessionId: event.sessionId,
        agentKey: event.agentKey,
        toolName: event.toolName,
        startedAt: event.timestamp - (event.duration || 0),
        completedAt: event.timestamp,
        status: 'success',
        inputSize: event.data?.inputSize,
        outputSize: event.data?.outputSize
      });
    });
    
    this.events.on('tool_error', async (event: ToolEvent) => {
      await this.analytics!.recordToolExecution({
        sessionId: event.sessionId,
        agentKey: event.agentKey,
        toolName: event.toolName,
        startedAt: event.timestamp - (event.duration || 0),
        completedAt: event.timestamp,
        status: 'error',
        errorMessage: event.error
      });
    });
    
    this.events.on('session_start', async (event: SessionEvent) => {
      await this.analytics!.recordSessionStart(event.sessionId, event.agentKey);
    });
    
    this.events.on('session_end', async (event: SessionEvent) => {
      if (event.data) {
        await this.analytics!.recordSessionEnd(event.sessionId, event.data);
      }
    });
  }

  private initializeAgents(): void {
    this.agents.set('file', new FileManagementAgent());
    this.agents.set('web', new WebResearchAgent());
    this.agents.set('code', new CodeAnalysisAgent());
    this.agents.set('task', new TaskPlanningAgent());
    this.agents.set('data', new DataProcessingAgent());
  }

  async processRequest(input: string, sessionId: string = 'default'): Promise<{
    response: string;
    agentResponses: AgentResponse[];
    executionTime: number;
    tokens?: number;
  }> {
    const startTime = Date.now();
    this.logger.info(`Processing request: ${input.substring(0, 100)}...`);

    try {
      // Get or create conversation context
      const context = this.getConversationContext(sessionId);
      
      // Add user message to history
      context.messages.push({ role: 'user', content: input });

      // Use Claude to determine which agents to use and how
      const agentPlan = await this.planExecution(input);
      this.logger.debug('Execution plan generated', agentPlan);

      // Execute the plan
      const agentResponses = await this.executeAgentPlan(agentPlan, input);
      
      // Generate final response using Claude
      const finalResponse = await this.generateFinalResponse(input, agentResponses, context);
      
      // Add assistant response to history
      context.messages.push({ role: 'assistant', content: finalResponse.response });
      
      // Trim history if needed
      this.trimConversationHistory(context);
      
      const executionTime = Date.now() - startTime;
      this.logger.info(`Request completed in ${executionTime}ms`);

      return {
        response: finalResponse.response,
        agentResponses,
        executionTime,
        tokens: finalResponse.tokens
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('Request processing failed', error);
      
      return {
        response: `I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        agentResponses: [],
        executionTime
      };
    }
  }

  private async planExecution(input: string): Promise<{
    agents: string[];
    strategy: string;
    reasoning: string;
  }> {
    const availableAgents = Array.from(this.agents.keys()).map(key => {
      const agent = this.agents.get(key)!;
      return `${key}: ${agent.description}`;
    }).join('\n');

    const planningPrompt = `You are an intelligent agent orchestrator. Analyze this user request and determine which agents should be used and in what order.

User Request: "${input}"

Available Agents:
${availableAgents}

Respond with a JSON object containing:
{
  "agents": ["agent1", "agent2", ...],
  "strategy": "sequential|parallel|conditional",
  "reasoning": "Brief explanation of why these agents were chosen"
}

Choose agents based on the request content. You can select multiple agents if the task requires different capabilities.`;

    try {
      const response = await this.claudeClient.messages.create({
        model: this.config.model,
        max_tokens: 500,
        messages: [{ role: 'user', content: planningPrompt }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      const plan = JSON.parse(responseText);
      
      // Validate the plan
      const validAgents = plan.agents.filter((agent: string) => this.agents.has(agent));
      
      return {
        agents: validAgents.length > 0 ? validAgents : ['file'], // Default to file agent if no valid agents
        strategy: plan.strategy || 'sequential',
        reasoning: plan.reasoning || 'Default agent selection'
      };

    } catch (error) {
      this.logger.warn('Failed to generate execution plan, using default', error);
      
      // Fallback logic
      const lowerInput = input.toLowerCase();
      let defaultAgents = ['file'];
      
      if (lowerInput.includes('code') || lowerInput.includes('analyze')) {
        defaultAgents = ['code'];
      } else if (lowerInput.includes('web') || lowerInput.includes('search') || lowerInput.includes('http')) {
        defaultAgents = ['web'];
      } else if (lowerInput.includes('csv') || lowerInput.includes('json') || lowerInput.includes('data')) {
        defaultAgents = ['data'];
      } else if (lowerInput.includes('task') || lowerInput.includes('plan')) {
        defaultAgents = ['task'];
      }
      
      return {
        agents: defaultAgents,
        strategy: 'sequential',
        reasoning: 'Fallback agent selection based on keyword analysis'
      };
    }
  }

  private async executeAgentPlan(
    plan: { agents: string[]; strategy: string },
    input: string
  ): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];

    if (plan.strategy === 'parallel') {
      // Execute agents in parallel
      const promises = plan.agents.map(async (agentKey) => {
        const agent = this.agents.get(agentKey);
        if (agent) {
          this.logger.debug(`Executing agent ${agentKey} in parallel`);
          return await agent.execute(input);
        }
        return {
          success: false,
          error: `Agent ${agentKey} not found`,
          toolsUsed: []
        };
      });

      const parallelResponses = await Promise.allSettled(promises);
      parallelResponses.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          responses.push(result.value);
        } else {
          this.logger.error(`Agent ${plan.agents[index]} failed`, result.reason);
          responses.push({
            success: false,
            error: `Agent execution failed: ${result.reason}`,
            toolsUsed: []
          });
        }
      });

    } else {
      // Execute agents sequentially
      for (const agentKey of plan.agents) {
        const agent = this.agents.get(agentKey);
        if (agent) {
          this.logger.debug(`Executing agent ${agentKey} sequentially`);
          
          try {
            const response = await agent.execute(input);
            responses.push(response);
            
            // If agent failed and it's critical, stop execution
            if (!response.success && this.isCriticalAgent(agentKey)) {
              this.logger.warn(`Critical agent ${agentKey} failed, stopping execution`);
              break;
            }
          } catch (error) {
            this.logger.error(`Agent ${agentKey} threw error`, error);
            responses.push({
              success: false,
              error: `Agent execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              toolsUsed: []
            });
          }
        } else {
          responses.push({
            success: false,
            error: `Agent ${agentKey} not found`,
            toolsUsed: []
          });
        }
      }
    }

    return responses;
  }

  private isCriticalAgent(agentKey: string): boolean {
    // Define which agents are critical for task completion
    return ['task'].includes(agentKey);
  }

  private async generateFinalResponse(
    originalInput: string,
    agentResponses: AgentResponse[],
    context: ConversationContext
  ): Promise<{ response: string; tokens: number }> {
    const successfulResponses = agentResponses.filter(r => r.success);
    const failedResponses = agentResponses.filter(r => !r.success);

    if (successfulResponses.length === 0) {
      return {
        response: "I wasn't able to complete your request successfully. " + 
                 failedResponses.map(r => r.error).join('; '),
        tokens: 0
      };
    }

    // Prepare context for Claude
    const agentResults = successfulResponses.map((response, index) => {
      return `Agent ${index + 1} Results:\n${JSON.stringify(response.result, null, 2)}`;
    }).join('\n\n');

    const responsePrompt = `You are a helpful AI assistant. A user made this request: "${originalInput}"

I executed several specialized agents to gather information and complete tasks. Here are the results:

${agentResults}

Based on these agent results, provide a clear, helpful response to the user's original request. 
- Summarize key findings
- Present information in a user-friendly way  
- If there were any issues, mention them constructively
- Be concise but comprehensive

Response:`;

    try {
      const claudeResponse = await this.claudeClient.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [{ role: 'user', content: responsePrompt }]
      });

      const responseText = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
      
      return {
        response: responseText,
        tokens: claudeResponse.usage?.output_tokens || 0
      };

    } catch (error) {
      this.logger.error('Failed to generate final response', error);
      
      // Fallback response
      const summary = successfulResponses.map((response, index) => 
        `Agent ${index + 1}: Completed with ${response.toolsUsed.length} tools`
      ).join(', ');

      return {
        response: `I completed your request using multiple agents. ${summary}. Raw results are available in the detailed response data.`,
        tokens: 0
      };
    }
  }

  // Utility methods
  getAvailableAgents(): { key: string; name: string; description: string }[] {
    return Array.from(this.agents.entries()).map(([key, agent]) => ({
      key,
      name: agent.name,
      description: agent.description
    }));
  }

  async executeSpecificAgent(agentKey: string, input: string): Promise<AgentResponse> {
    const agent = this.agents.get(agentKey);
    if (!agent) {
      return {
        success: false,
        error: `Agent '${agentKey}' not found`,
        toolsUsed: []
      };
    }

    this.logger.info(`Executing specific agent: ${agentKey}`);
    return await agent.execute(input);
  }

  async executeAgentWithTools(
    agentKey: string,
    input: string,
    sessionId: string = 'default'
  ): Promise<AgentResponse> {
    const agent = this.agents.get(agentKey);
    if (!agent) {
      return {
        success: false,
        error: `Agent '${agentKey}' not found`,
        toolsUsed: []
      };
    }

    // Create a fresh context for each tool execution to avoid conversation state issues
    const context: ConversationContext = {
      messages: [],
      maxHistory: 20
    };
    context.messages.push({ role: 'user', content: input });

    const tools = agent.getAnthropicTools();
    const toolsUsed: string[] = [];
    let continueLoop = true;
    let finalResult: any = null;

    this.logger.info(`Executing agent ${agentKey} with tool use support`);
    
    // Emit session start event
    await this.events.emit('session_start', {
      type: 'session_start' as const,
      sessionId,
      agentKey,
      timestamp: Date.now()
    });

    while (continueLoop) {
      try {
        const response = await this.claudeClient.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          messages: context.messages,
          tools: tools.length > 0 ? tools : undefined
        });

        // Process response
        const toolUseBlocks: ToolUseBlock[] = [];
        let textResponse = '';

        for (const content of response.content) {
          if (content.type === 'text') {
            textResponse += (content as TextBlock).text;
          } else if (content.type === 'tool_use') {
            toolUseBlocks.push(content as ToolUseBlock);
          }
        }

        if (toolUseBlocks.length === 0) {
          // No more tools to execute, we're done
          context.messages.push({ role: 'assistant', content: response.content });
          finalResult = textResponse;
          continueLoop = false;
        } else {
          // Execute tools and continue conversation
          context.messages.push({ role: 'assistant', content: response.content });
          
          const toolResults = await Promise.all(
            toolUseBlocks.map(async (toolUse) => {
              const tool = agent.tools.find(t => t.name === toolUse.name);
              
              if (!tool) {
                return {
                  type: 'tool_result' as const,
                  tool_use_id: toolUse.id,
                  content: `Error: Tool ${toolUse.name} not found`,
                  is_error: true
                };
              }

              toolsUsed.push(tool.name);
              this.logger.debug(`Executing tool: ${tool.name}`);
              
              const toolStartTime = Date.now();
              
              // Emit tool start event
              await this.events.emit('tool_start', {
                type: 'tool_start' as const,
                sessionId,
                agentKey,
                toolName: tool.name,
                timestamp: toolStartTime,
                data: { input: toolUse.input }
              });

              try {
                const result = await tool.execute(toolUse.input);
                const toolEndTime = Date.now();
                
                // Emit tool complete event
                await this.events.emit('tool_complete', {
                  type: 'tool_complete' as const,
                  sessionId,
                  agentKey,
                  toolName: tool.name,
                  timestamp: toolEndTime,
                  duration: toolEndTime - toolStartTime,
                  data: { 
                    inputSize: JSON.stringify(toolUse.input).length,
                    outputSize: JSON.stringify(result).length
                  }
                });
                
                return {
                  type: 'tool_result' as const,
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(result)
                };
              } catch (error) {
                const toolEndTime = Date.now();
                
                // Emit tool error event
                await this.events.emit('tool_error', {
                  type: 'tool_error' as const,
                  sessionId,
                  agentKey,
                  toolName: tool.name,
                  timestamp: toolEndTime,
                  duration: toolEndTime - toolStartTime,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
                
                return {
                  type: 'tool_result' as const,
                  tool_use_id: toolUse.id,
                  content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  is_error: true
                };
              }
            })
          );

          context.messages.push({ role: 'user', content: toolResults });
        }

        // Stop after reasonable number of turns
        if (context.messages.length > 50) {
          this.logger.warn('Max conversation turns reached');
          continueLoop = false;
        }

      } catch (error) {
        this.logger.error('Error in tool execution loop', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          toolsUsed
        };
      }
    }

    this.trimConversationHistory(context);
    
    // Emit session end event
    const successCount = toolsUsed.length; // All completed tools (errors would have thrown)
    await this.events.emit('session_end', {
      type: 'session_end' as const,
      sessionId,
      agentKey,
      timestamp: Date.now(),
      data: {
        totalTools: toolsUsed.length,
        successCount,
        errorCount: 0,
        finalResult
      }
    });

    return {
      success: true,
      result: finalResult,
      toolsUsed,
      metadata: { timestamp: new Date().toISOString() }
    };
  }

  getAgentTools(agentKey: string): any[] {
    const agent = this.agents.get(agentKey);
    if (!agent) return [];
    
    return agent.tools.map(tool => ({
      name: tool.name,
      description: tool.description
    }));
  }

  async health(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    agents: Record<string, 'online' | 'offline'>;
    claudeConnection: 'connected' | 'disconnected';
    uptime: number;
  }> {
    const startTime = Date.now();
    const agentStatus: Record<string, 'online' | 'offline'> = {};
    
    // Test each agent
    for (const [key, agent] of this.agents) {
      try {
        // Simple health check - try to execute with minimal input
        await agent.execute('health check');
        agentStatus[key] = 'online';
      } catch {
        agentStatus[key] = 'offline';
      }
    }

    // Test Claude connection
    let claudeConnection: 'connected' | 'disconnected' = 'connected';
    try {
      await this.claudeClient.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }]
      });
    } catch {
      claudeConnection = 'disconnected';
    }

    const onlineAgents = Object.values(agentStatus).filter(status => status === 'online').length;
    const totalAgents = Object.keys(agentStatus).length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (claudeConnection === 'disconnected' || onlineAgents === 0) {
      overallStatus = 'unhealthy';
    } else if (onlineAgents < totalAgents) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      agents: agentStatus,
      claudeConnection,
      uptime: Date.now() - startTime
    };
  }

  private getConversationContext(sessionId: string): ConversationContext {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, {
        messages: [],
        maxHistory: 20
      });
    }
    return this.conversationHistory.get(sessionId)!;
  }

  private trimConversationHistory(context: ConversationContext): void {
    const maxHistory = context.maxHistory || 20;
    if (context.messages.length > maxHistory) {
      context.messages = context.messages.slice(-maxHistory);
    }
  }

  clearConversation(sessionId: string = 'default'): void {
    this.conversationHistory.delete(sessionId);
    this.logger.info(`Conversation history cleared for session: ${sessionId}`);
  }

  // Configuration management
  updateConfig(newConfig: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.anthropicApiKey) {
      this.claudeClient = new Anthropic({ apiKey: newConfig.anthropicApiKey });
    }
    
    this.logger.info('Configuration updated');
  }

  getConfig(): Omit<Required<OrchestratorConfig>, 'anthropicApiKey'> {
    const { anthropicApiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
  
  getAnalytics(): AnalyticsEngine | undefined {
    return this.analytics;
  }
}