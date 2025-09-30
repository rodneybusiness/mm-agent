export type EventHandler = (...args: any[]) => void | Promise<void>;

export interface ToolEvent {
  type: 'tool_start' | 'tool_complete' | 'tool_error';
  sessionId: string;
  agentKey: string;
  toolName: string;
  timestamp: number;
  data?: any;
  error?: string;
  duration?: number;
}

export interface SessionEvent {
  type: 'session_start' | 'session_end';
  sessionId: string;
  agentKey: string;
  timestamp: number;
  data?: any;
}

export interface WorkflowEvent {
  type: 'workflow_start' | 'workflow_end' | 'workflow_step';
  workflowName: string;
  timestamp: number;
  data?: any;
  error?: string;
}

export type AgentEvent = ToolEvent | SessionEvent | WorkflowEvent;

export class EventEmitter {
  private handlers = new Map<string, EventHandler[]>();
  private wildCardHandlers: EventHandler[] = [];

  on(event: string, handler: EventHandler): void {
    if (event === '*') {
      this.wildCardHandlers.push(handler);
      return;
    }

    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    if (event === '*') {
      const index = this.wildCardHandlers.indexOf(handler);
      if (index > -1) {
        this.wildCardHandlers.splice(index, 1);
      }
      return;
    }

    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  async emit(event: string, data: any): Promise<void> {
    const handlers = this.handlers.get(event) || [];
    const allHandlers = [...handlers, ...this.wildCardHandlers];

    await Promise.all(
      allHandlers.map(async (handler) => {
        try {
          await handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      })
    );
  }

  once(event: string, handler: EventHandler): void {
    const onceHandler: EventHandler = async (...args) => {
      this.off(event, onceHandler);
      await handler(...args);
    };
    this.on(event, onceHandler);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
      this.wildCardHandlers = [];
    }
  }

  listenerCount(event: string): number {
    if (event === '*') {
      return this.wildCardHandlers.length;
    }
    return this.handlers.get(event)?.length || 0;
  }

  eventNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}
