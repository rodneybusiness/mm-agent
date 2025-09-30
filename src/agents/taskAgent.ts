import { Agent, Tool, AgentResponse, AnthropicTool, TaskPlanSchema, ExecuteTaskSchema, TaskStep, ExecutionPlan } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class TaskPlanningAgent implements Agent {
  name = 'Task Planning Agent';
  description = 'Breaks down complex tasks into manageable steps and orchestrates their execution';
  
  private executionPlans = new Map<string, ExecutionPlan>();
  private availableAgents = new Map<string, string>();
  
  tools: Tool[] = [
    {
      name: 'create_plan',
      description: 'Create an execution plan for a complex task',
      schema: TaskPlanSchema,
      execute: this.createPlan.bind(this)
    },
    {
      name: 'execute_plan',
      description: 'Execute a specific step or entire plan',
      schema: ExecuteTaskSchema,
      execute: this.executePlan.bind(this)
    },
    {
      name: 'get_plan_status',
      description: 'Get the status of an execution plan',
      schema: ExecuteTaskSchema,
      execute: this.getPlanStatus.bind(this)
    },
    {
      name: 'modify_plan',
      description: 'Modify an existing execution plan',
      schema: ExecuteTaskSchema,
      execute: this.modifyPlan.bind(this)
    }
  ];

  constructor() {
    // Register available agents for task delegation
    this.availableAgents.set('file', 'File Management Agent');
    this.availableAgents.set('web', 'Web Research Agent');
    this.availableAgents.set('code', 'Code Analysis Agent');
    this.availableAgents.set('data', 'Data Processing Agent');
  }

  async execute(input: string): Promise<AgentResponse> {
    try {
      const parsed = this.parseInput(input);
      const tool = this.tools.find(t => t.name === parsed.tool);
      
      if (!tool) {
        return {
          success: false,
          error: `Unknown tool: ${parsed.tool}`,
          toolsUsed: []
        };
      }

      const result = await tool.execute(parsed.params);
      return {
        success: true,
        result,
        toolsUsed: [tool.name],
        metadata: { 
          timestamp: new Date().toISOString(),
          planId: parsed.params.planId 
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        toolsUsed: []
      };
    }
  }

  private parseInput(input: string): { tool: string; params: any } {
    const lowerInput = input.toLowerCase();
    
    // Check if input contains a plan ID (UUID pattern)
    const planIdMatch = input.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    
    if (lowerInput.includes('status') || lowerInput.includes('check')) {
      return {
        tool: 'get_plan_status',
        params: { planId: planIdMatch?.[0] || '' }
      };
    }
    
    if (lowerInput.includes('execute') || lowerInput.includes('run')) {
      return {
        tool: 'execute_plan',
        params: { 
          planId: planIdMatch?.[0] || '',
          stepId: this.extractStepId(input)
        }
      };
    }
    
    if (lowerInput.includes('modify') || lowerInput.includes('update') || lowerInput.includes('change')) {
      return {
        tool: 'modify_plan',
        params: { planId: planIdMatch?.[0] || '' }
      };
    }
    
    // Default to creating a new plan
    return {
      tool: 'create_plan',
      params: { 
        objective: input.trim(),
        maxSteps: 10
      }
    };
  }

  private extractStepId(input: string): string | undefined {
    const stepMatch = input.match(/step[:\s]+([a-f0-9-]+)/i);
    return stepMatch?.[1];
  }

  async createPlan(params: any): Promise<any> {
    const { objective, context, constraints = [], maxSteps = 10 } = TaskPlanSchema.parse(params);
    
    const planId = uuidv4();
    const steps = await this.generateSteps(objective, context, constraints, maxSteps);
    
    const executionPlan: ExecutionPlan = {
      id: planId,
      description: objective,
      steps,
      status: 'pending'
    };
    
    this.executionPlans.set(planId, executionPlan);
    
    return {
      planId,
      objective,
      stepsCount: steps.length,
      steps: steps.map(step => ({
        id: step.id,
        description: step.description,
        agent: step.agent,
        dependencies: step.dependencies,
        status: step.status
      })),
      estimatedDuration: this.estimateDuration(steps),
      created: new Date().toISOString()
    };
  }

  private async generateSteps(
    objective: string, 
    context?: string, 
    constraints: string[] = [], 
    maxSteps: number = 10
  ): Promise<TaskStep[]> {
    const steps: TaskStep[] = [];
    const lowerObjective = objective.toLowerCase();
    
    // Intelligent step generation based on objective analysis
    const taskPatterns = [
      {
        pattern: /analyze.*code|code.*analysis|review.*code/,
        steps: [
          { description: 'Scan project structure', agent: 'file' },
          { description: 'Analyze code quality and complexity', agent: 'code' },
          { description: 'Generate improvement suggestions', agent: 'code' },
          { description: 'Create analysis report', agent: 'file' }
        ]
      },
      {
        pattern: /research.*web|web.*search|find.*information/,
        steps: [
          { description: 'Define search strategy', agent: 'web' },
          { description: 'Perform web searches', agent: 'web' },
          { description: 'Extract relevant information', agent: 'web' },
          { description: 'Compile research report', agent: 'file' }
        ]
      },
      {
        pattern: /process.*data|analyze.*csv|parse.*json/,
        steps: [
          { description: 'Load and validate data', agent: 'data' },
          { description: 'Process and transform data', agent: 'data' },
          { description: 'Generate analytics', agent: 'data' },
          { description: 'Export results', agent: 'file' }
        ]
      },
      {
        pattern: /create.*documentation|generate.*docs/,
        steps: [
          { description: 'Analyze project structure', agent: 'file' },
          { description: 'Extract code documentation', agent: 'code' },
          { description: 'Generate documentation content', agent: 'code' },
          { description: 'Create documentation files', agent: 'file' }
        ]
      }
    ];

    // Find matching pattern
    let selectedSteps: any[] = [];
    for (const pattern of taskPatterns) {
      if (pattern.pattern.test(lowerObjective)) {
        selectedSteps = pattern.steps;
        break;
      }
    }

    // If no pattern matched, create generic steps
    if (selectedSteps.length === 0) {
      selectedSteps = [
        { description: 'Analyze the objective', agent: 'file' },
        { description: 'Gather required resources', agent: 'file' },
        { description: 'Execute main task', agent: 'code' },
        { description: 'Validate results', agent: 'file' }
      ];
    }

    // Create TaskStep objects with dependencies
    for (let i = 0; i < Math.min(selectedSteps.length, maxSteps); i++) {
      const stepTemplate = selectedSteps[i];
      const stepId = uuidv4();
      
      const step: TaskStep = {
        id: stepId,
        description: stepTemplate.description,
        agent: stepTemplate.agent,
        dependencies: i > 0 ? [steps[i - 1].id] : [],
        status: 'pending'
      };
      
      steps.push(step);
    }

    // Apply constraints
    if (constraints.includes('parallel')) {
      // Remove some dependencies to allow parallel execution
      steps.forEach((step, index) => {
        if (index > 1) {
          step.dependencies = step.dependencies.slice(-1); // Keep only last dependency
        }
      });
    }

    if (constraints.includes('fast')) {
      // Reduce number of steps
      return steps.slice(0, Math.min(3, steps.length));
    }

    return steps;
  }

  private estimateDuration(steps: TaskStep[]): string {
    // Simple duration estimation
    const baseMinutes = steps.length * 2; // 2 minutes per step
    const complexityMultiplier = steps.some(s => s.agent === 'code') ? 1.5 : 1;
    const totalMinutes = Math.round(baseMinutes * complexityMultiplier);
    
    if (totalMinutes < 60) {
      return `~${totalMinutes} minutes`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `~${hours}h ${minutes}m`;
    }
  }

  async executePlan(params: any): Promise<any> {
    const { planId, stepId } = ExecuteTaskSchema.parse(params);
    
    const plan = this.executionPlans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    if (stepId) {
      // Execute specific step
      return await this.executeStep(plan, stepId);
    } else {
      // Execute entire plan
      return await this.executeEntirePlan(plan);
    }
  }

  private async executeStep(plan: ExecutionPlan, stepId: string): Promise<any> {
    const step = plan.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    // Check dependencies
    const dependenciesCompleted = step.dependencies.every(depId => {
      const depStep = plan.steps.find(s => s.id === depId);
      return depStep?.status === 'completed';
    });

    if (!dependenciesCompleted) {
      return {
        stepId,
        status: 'blocked',
        message: 'Dependencies not completed',
        dependencies: step.dependencies
      };
    }

    // Mark step as in progress
    step.status = 'in_progress';
    plan.status = 'in_progress';

    try {
      // Simulate step execution (in real implementation, would delegate to appropriate agent)
      const result = await this.delegateToAgent(step.agent, step.description, plan);
      
      step.status = 'completed';
      step.result = result;

      // Check if all steps are completed
      if (plan.steps.every(s => s.status === 'completed')) {
        plan.status = 'completed';
      }

      return {
        stepId,
        status: 'completed',
        result,
        nextSteps: this.getNextAvailableSteps(plan)
      };

    } catch (error) {
      step.status = 'failed';
      plan.status = 'failed';
      
      return {
        stepId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeEntirePlan(plan: ExecutionPlan): Promise<any> {
    const results: any[] = [];
    plan.status = 'in_progress';

    try {
      // Execute steps in dependency order
      const executionOrder = this.calculateExecutionOrder(plan.steps);
      
      for (const stepId of executionOrder) {
        const stepResult = await this.executeStep(plan, stepId);
        results.push(stepResult);
        
        if (stepResult.status === 'failed') {
          plan.status = 'failed';
          break;
        }
      }

      if (plan.status !== 'failed') {
        plan.status = 'completed';
      }

      return {
        planId: plan.id,
        status: plan.status,
        completedSteps: results.filter(r => r.status === 'completed').length,
        totalSteps: plan.steps.length,
        results,
        duration: this.calculateActualDuration(plan)
      };

    } catch (error) {
      plan.status = 'failed';
      return {
        planId: plan.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        results
      };
    }
  }

  private calculateExecutionOrder(steps: TaskStep[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (stepId: string) => {
      if (visiting.has(stepId)) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(stepId)) {
        return;
      }

      visiting.add(stepId);
      const step = steps.find(s => s.id === stepId)!;
      
      for (const depId of step.dependencies) {
        visit(depId);
      }
      
      visiting.delete(stepId);
      visited.add(stepId);
      order.push(stepId);
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        visit(step.id);
      }
    }

    return order;
  }

  private async delegateToAgent(agentType: string, task: string, plan: ExecutionPlan): Promise<any> {
    // In a real implementation, this would delegate to actual agent instances
    // For now, simulate agent execution
    
    const simulatedDelay = Math.random() * 1000 + 500; // 0.5-1.5 seconds
    await new Promise(resolve => setTimeout(resolve, simulatedDelay));
    
    return {
      agent: agentType,
      task,
      status: 'completed',
      timestamp: new Date().toISOString(),
      simulated: true,
      message: `Task "${task}" completed by ${this.availableAgents.get(agentType) || agentType}`
    };
  }

  private getNextAvailableSteps(plan: ExecutionPlan): string[] {
    return plan.steps
      .filter(step => {
        if (step.status !== 'pending') return false;
        return step.dependencies.every(depId => {
          const depStep = plan.steps.find(s => s.id === depId);
          return depStep?.status === 'completed';
        });
      })
      .map(step => step.id);
  }

  private calculateActualDuration(plan: ExecutionPlan): string {
    const completedSteps = plan.steps.filter(s => s.status === 'completed');
    const avgStepTime = 30; // 30 seconds average per step
    const totalSeconds = completedSteps.length * avgStepTime;
    
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    } else {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}m ${seconds}s`;
    }
  }

  async getPlanStatus(params: any): Promise<any> {
    const { planId } = ExecuteTaskSchema.parse(params);
    
    const plan = this.executionPlans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    const completed = plan.steps.filter(s => s.status === 'completed').length;
    const inProgress = plan.steps.filter(s => s.status === 'in_progress').length;
    const failed = plan.steps.filter(s => s.status === 'failed').length;
    const pending = plan.steps.filter(s => s.status === 'pending').length;

    return {
      planId: plan.id,
      description: plan.description,
      status: plan.status,
      progress: {
        completed,
        inProgress,
        failed,
        pending,
        total: plan.steps.length,
        percentage: Math.round((completed / plan.steps.length) * 100)
      },
      steps: plan.steps.map(step => ({
        id: step.id,
        description: step.description,
        agent: step.agent,
        status: step.status,
        dependencies: step.dependencies,
        hasResult: !!step.result
      })),
      nextAvailableSteps: this.getNextAvailableSteps(plan),
      lastUpdated: new Date().toISOString()
    };
  }

  async modifyPlan(params: any): Promise<any> {
    const { planId } = ExecuteTaskSchema.parse(params);
    
    const plan = this.executionPlans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // For now, just return plan modification capabilities
    return {
      planId: plan.id,
      currentStatus: plan.status,
      modificationOptions: [
        'Add new step',
        'Remove step',
        'Modify step description',
        'Change step dependencies',
        'Reorder steps',
        'Pause/Resume execution'
      ],
      restrictions: plan.status === 'in_progress' ? [
        'Cannot modify completed steps',
        'Cannot remove steps with dependencies'
      ] : [],
      message: 'Plan modification interface - specific modifications would be implemented based on user input'
    };
  }

  // Utility method to get all plans
  getAllPlans(): ExecutionPlan[] {
    return Array.from(this.executionPlans.values());
  }

  // Utility method to clear completed plans
  clearCompletedPlans(): number {
    const completedPlans = Array.from(this.executionPlans.entries())
      .filter(([_, plan]) => plan.status === 'completed');
    
    completedPlans.forEach(([planId, _]) => {
      this.executionPlans.delete(planId);
    });

    return completedPlans.length;
  }

  getAnthropicTools(): AnthropicTool[] {
    return this.tools.map(tool => {
      const jsonSchema = zodToJsonSchema(tool.schema, { $refStrategy: 'none' }) as any;
      return {
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object',
          properties: jsonSchema.properties || {},
          required: jsonSchema.required || []
        }
      };
    });
  }
}