import express, { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import * as path from 'path';
import { AgentOrchestrator } from '../core/orchestrator';
import { ToolEvent, SessionEvent, WorkflowEvent } from '../core/event-emitter';
import rateLimit from 'express-rate-limit';

export interface DashboardConfig {
  port?: number;
  orchestrator: AgentOrchestrator;
  enableCors?: boolean;
}

export class DashboardServer {
  private app: Express;
  private httpServer: HTTPServer;
  private io: SocketIOServer;
  private orchestrator: AgentOrchestrator;
  private port: number;

  constructor(config: DashboardConfig) {
    this.orchestrator = config.orchestrator;
    this.port = config.port || 3000;
    
    // Initialize Express
    this.app = express();
    this.httpServer = createServer(this.app);
    
    // Initialize Socket.IO
    this.io = new SocketIOServer(this.httpServer, {
      cors: config.enableCors ? {
        origin: "*",
        methods: ["GET", "POST"]
      } : undefined
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupEventListeners();
  }

  private setupMiddleware(): void {
    // Body parser
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    this.app.use('/api/', limiter);

    // Static files
    this.app.use(express.static(path.join(__dirname, 'public')));

    // CORS for API routes
    this.app.use('/api/', (req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', async (req: Request, res: Response) => {
      try {
        const health = await this.orchestrator.health();
        res.json({ status: 'ok', ...health });
      } catch (error) {
        res.status(500).json({ 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Get available agents
    this.app.get('/api/agents', (req: Request, res: Response) => {
      const agents = this.orchestrator.getAvailableAgents();
      res.json({ agents });
    });

    // Execute agent
    this.app.post('/api/agents/:agentKey/execute', async (req: Request, res: Response) => {
      try {
        const { agentKey } = req.params;
        const { input, sessionId } = req.body;

        if (!input) {
          return res.status(400).json({ error: 'Input is required' });
        }

        const result = await this.orchestrator.executeAgentWithTools(
          agentKey,
          input,
          sessionId || `web-${Date.now()}`
        );

        res.json(result);
      } catch (error) {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Analytics endpoints
    const analytics = this.orchestrator.getAnalytics();
    if (analytics) {
      // Tool metrics
      this.app.get('/api/analytics/tools', async (req: Request, res: Response) => {
        try {
          const metrics = await analytics.getToolMetrics();
          res.json(metrics);
        } catch (error) {
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      // Agent metrics
      this.app.get('/api/analytics/agents/:agentKey', async (req: Request, res: Response) => {
        try {
          const { agentKey } = req.params;
          const metrics = await analytics.getAgentMetrics(agentKey);
          res.json(metrics);
        } catch (error) {
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      // Top tools
      this.app.get('/api/analytics/tools/top', async (req: Request, res: Response) => {
        try {
          const limit = parseInt(req.query.limit as string) || 10;
          const topTools = await analytics.getTopTools(limit);
          res.json({ tools: topTools });
        } catch (error) {
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      // Error rate
      this.app.get('/api/analytics/error-rate', async (req: Request, res: Response) => {
        try {
          const errorRate = await analytics.getErrorRate();
          res.json({ errorRate });
        } catch (error) {
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      // Session history
      this.app.get('/api/analytics/sessions', async (req: Request, res: Response) => {
        try {
          const limit = parseInt(req.query.limit as string) || 50;
          const sessions = await analytics.getSessionHistory(limit);
          res.json({ sessions });
        } catch (error) {
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      // Recent executions
      this.app.get('/api/analytics/executions/recent', async (req: Request, res: Response) => {
        try {
          const limit = parseInt(req.query.limit as string) || 100;
          const executions = await analytics.getRecentExecutions(limit);
          res.json({ executions });
        } catch (error) {
          res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });
    }

    // Serve dashboard HTML
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });

      // Handle client requests to execute agents
      socket.on('execute', async (data: { agentKey: string; input: string; sessionId?: string }) => {
        try {
          const result = await this.orchestrator.executeAgentWithTools(
            data.agentKey,
            data.input,
            data.sessionId || `socket-${socket.id}-${Date.now()}`
          );

          socket.emit('result', result);
        } catch (error) {
          socket.emit('error', { 
            message: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });
    });
  }

  private setupEventListeners(): void {
    // Forward all orchestrator events to connected clients
    this.orchestrator.events.on('tool_start', (event: ToolEvent) => {
      this.io.emit('tool_event', event);
    });

    this.orchestrator.events.on('tool_complete', (event: ToolEvent) => {
      this.io.emit('tool_event', event);
    });

    this.orchestrator.events.on('tool_error', (event: ToolEvent) => {
      this.io.emit('tool_event', event);
    });

    this.orchestrator.events.on('session_start', (event: SessionEvent) => {
      this.io.emit('session_event', event);
    });

    this.orchestrator.events.on('session_end', (event: SessionEvent) => {
      this.io.emit('session_event', event);
    });
  }

  start(): void {
    this.httpServer.listen(this.port, () => {
      console.log(`\n🚀 Dashboard server started`);
      console.log(`📊 Dashboard: http://localhost:${this.port}`);
      console.log(`🔌 WebSocket: ws://localhost:${this.port}`);
      console.log(`📡 API: http://localhost:${this.port}/api\n`);
    });
  }

  stop(): void {
    this.httpServer.close();
    this.io.close();
  }
}
