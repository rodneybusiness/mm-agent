# MM-Agent v1.2.0 Architecture Design

## 🎯 Complete Implementation Plan

This document outlines the elegant, one-shot implementation of 4 major features:
1. Web Dashboard with Real-Time Tool Visualization
2. Plugin System with Auto-Discovery
3. Advanced Workflow Templates
4. Tool Execution Analytics

---

## 📐 System Architecture Overview

```
mm-agent/
├── src/
│   ├── agents/              # Existing: 5 specialized agents
│   ├── core/
│   │   ├── orchestrator.ts  # Existing: Enhanced with events
│   │   ├── logger.ts        # Existing
│   │   ├── analytics.ts     # NEW: Analytics engine
│   │   ├── plugin-loader.ts # NEW: Plugin discovery & loading
│   │   └── workflow-engine.ts # NEW: Workflow execution
│   ├── plugins/             # NEW: Plugin directory
│   │   ├── example-plugin/
│   │   └── plugin-interface.ts
│   ├── workflows/           # NEW: Workflow definitions
│   │   └── examples/
│   ├── dashboard/           # NEW: Web UI
│   │   ├── server.ts        # Express + Socket.io
│   │   ├── public/          # Static files
│   │   └── components/      # UI components
│   └── types/               # Existing: Enhanced with new types
├── data/
│   └── analytics.db         # NEW: SQLite database
└── tests/                   # NEW: Comprehensive test suite
```

---

## Phase 1: Web Dashboard with Real-Time Tool Visualization

### Architecture
**Tech Stack:**
- **Backend:** Express.js with Socket.io for real-time events
- **Frontend:** Vanilla JS with modern ES6 (no framework needed)
- **Styling:** Tailwind CSS via CDN
- **Protocol:** Server-Sent Events (SSE) for tool execution streams

### Key Components

#### 1.1 Event System
```typescript
// Add to orchestrator.ts
interface ToolEvent {
  type: 'tool_start' | 'tool_complete' | 'tool_error';
  agentKey: string;
  toolName: string;
  sessionId: string;
  timestamp: number;
  data?: any;
  error?: string;
}

class EventEmitter {
  private handlers = new Map<string, Function[]>();
  
  on(event: string, handler: Function): void;
  emit(event: string, data: any): void;
}
```

#### 1.2 Dashboard Server
```typescript
// src/dashboard/server.ts
class DashboardServer {
  private app: Express;
  private io: SocketIO;
  private orchestrator: AgentOrchestrator;
  
  start(port: number): void;
  broadcastToolEvent(event: ToolEvent): void;
  handleClientRequest(request: any): Promise<void>;
}
```

#### 1.3 Frontend Features
- **Live Tool Execution View:** Real-time streaming of tool calls
- **Agent Status Monitor:** Health and activity per agent
- **Request History:** Paginated list with search
- **Tool Call Timeline:** Visual representation of tool orchestration
- **JSON Inspector:** Interactive tool input/output viewer

### Implementation Files
```
src/dashboard/
├── server.ts              # Express + Socket.io server
├── public/
│   ├── index.html         # Main dashboard UI
│   ├── style.css          # Custom styles
│   └── app.js             # Frontend JavaScript
└── middleware/
    └── auth.ts            # Optional: Basic auth
```

---

## Phase 2: Plugin System with Auto-Discovery

### Architecture
**Design Philosophy:** Convention over configuration

### Key Components

#### 2.1 Plugin Interface
```typescript
// src/plugins/plugin-interface.ts
export interface Plugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  
  // Lifecycle hooks
  initialize?(orchestrator: AgentOrchestrator): Promise<void>;
  beforeRequest?(input: string): Promise<string>;
  afterResponse?(response: any): Promise<any>;
  
  // Optional: Add custom agents
  agents?: Agent[];
  
  // Optional: Add custom tools to existing agents
  tools?: Map<string, Tool[]>;
}
```

#### 2.2 Plugin Loader
```typescript
// src/core/plugin-loader.ts
class PluginLoader {
  private plugins = new Map<string, Plugin>();
  
  async discoverPlugins(directory: string): Promise<Plugin[]>;
  async loadPlugin(path: string): Promise<Plugin>;
  async initializePlugins(orchestrator: AgentOrchestrator): Promise<void>;
  
  getPlugin(name: string): Plugin | undefined;
  listPlugins(): Plugin[];
}
```

#### 2.3 Plugin Directory Structure
```
plugins/
├── email-agent/
│   ├── package.json       # Plugin metadata
│   ├── index.ts           # Plugin export
│   ├── agent.ts           # Email agent implementation
│   └── README.md
├── database-connector/
│   ├── package.json
│   ├── index.ts
│   ├── postgres-tool.ts
│   └── mysql-tool.ts
└── slack-integration/
    ├── package.json
    ├── index.ts
    └── slack-agent.ts
```

#### 2.4 Example Plugin
```typescript
// plugins/example-plugin/index.ts
export default {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'Example plugin demonstrating the API',
  
  async initialize(orchestrator) {
    console.log('Plugin initialized!');
  },
  
  async beforeRequest(input) {
    // Transform input before processing
    return input.trim();
  },
  
  agents: [
    new CustomAgent()
  ]
} as Plugin;
```

---

## Phase 3: Advanced Workflow Templates

### Architecture
**Format:** YAML for human readability
**Engine:** Custom workflow executor with plugin support

### Key Components

#### 3.1 Workflow Definition Schema
```yaml
# workflows/examples/data-analysis.yaml
name: "Data Analysis Workflow"
version: "1.0.0"
description: "Fetch data, analyze, and generate report"

inputs:
  - name: data_source
    type: string
    required: true
  - name: output_format
    type: enum
    values: [json, csv, pdf]
    default: json

steps:
  - id: fetch_data
    agent: web
    action: scrape_webpage
    params:
      url: "{{ inputs.data_source }}"
    outputs:
      data: result.content

  - id: analyze_data
    agent: data
    action: analyze_data
    params:
      data: "{{ steps.fetch_data.outputs.data }}"
    depends_on: [fetch_data]

  - id: generate_report
    agent: file
    action: write_file
    params:
      path: "report.{{ inputs.output_format }}"
      content: "{{ steps.analyze_data.outputs.result }}"
    depends_on: [analyze_data]

outputs:
  report_path: "{{ steps.generate_report.outputs.path }}"
  analysis: "{{ steps.analyze_data.outputs.result }}"
```

#### 3.2 Workflow Engine
```typescript
// src/core/workflow-engine.ts
interface WorkflowDefinition {
  name: string;
  version: string;
  description: string;
  inputs: WorkflowInput[];
  steps: WorkflowStep[];
  outputs: Record<string, string>;
}

interface WorkflowStep {
  id: string;
  agent: string;
  action: string;
  params: Record<string, any>;
  depends_on?: string[];
  retry?: number;
  timeout?: number;
}

class WorkflowEngine {
  async loadWorkflow(path: string): Promise<WorkflowDefinition>;
  async executeWorkflow(
    workflow: WorkflowDefinition,
    inputs: Record<string, any>
  ): Promise<WorkflowResult>;
  
  private resolveTemplate(template: string, context: any): any;
  private buildExecutionGraph(steps: WorkflowStep[]): ExecutionGraph;
  private executeStep(step: WorkflowStep, context: any): Promise<any>;
}
```

#### 3.3 Template Variables
```typescript
// Supported template syntax
"{{ inputs.variable_name }}"           // Input variables
"{{ steps.step_id.outputs.key }}"      // Step outputs
"{{ env.VARIABLE_NAME }}"              // Environment variables
"{{ datetime.now }}"                   // Built-in functions
```

---

## Phase 4: Tool Execution Analytics

### Architecture
**Database:** SQLite for simplicity and portability
**Visualization:** Dashboard integration for live charts

### Key Components

#### 4.1 Database Schema
```sql
-- data/schema.sql

CREATE TABLE tool_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  agent_key TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,
  status TEXT CHECK(status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  input_size INTEGER,
  output_size INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE agent_sessions (
  session_id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  total_tools INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE workflow_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT,
  inputs TEXT,
  outputs TEXT,
  error_message TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_tool_executions_agent ON tool_executions(agent_key);
CREATE INDEX idx_tool_executions_tool ON tool_executions(tool_name);
CREATE INDEX idx_tool_executions_session ON tool_executions(session_id);
CREATE INDEX idx_tool_executions_time ON tool_executions(started_at);
```

#### 4.2 Analytics Engine
```typescript
// src/core/analytics.ts
interface ToolMetrics {
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  errorCount: number;
  mostUsedTools: Array<{name: string; count: number}>;
}

interface AgentMetrics {
  agentKey: string;
  totalSessions: number;
  averageToolsPerSession: number;
  successRate: number;
  popularTools: string[];
}

class AnalyticsEngine {
  private db: Database;
  
  // Recording
  async recordToolExecution(event: ToolExecutionEvent): Promise<void>;
  async recordSessionStart(sessionId: string): Promise<void>;
  async recordSessionEnd(sessionId: string, metrics: SessionMetrics): Promise<void>;
  
  // Querying
  async getToolMetrics(timeRange?: TimeRange): Promise<ToolMetrics>;
  async getAgentMetrics(agentKey: string): Promise<AgentMetrics>;
  async getTopTools(limit: number): Promise<ToolUsageStats[]>;
  async getErrorRate(timeRange?: TimeRange): Promise<number>;
  async getSessionHistory(limit: number): Promise<Session[]>;
  
  // Reporting
  async generateReport(type: 'daily' | 'weekly' | 'monthly'): Promise<Report>;
}
```

#### 4.3 Dashboard Analytics Views
- **Overview:** Total executions, success rate, avg duration
- **Tool Performance:** Bar charts of tool usage and performance
- **Agent Activity:** Pie chart of agent distribution
- **Error Trends:** Line graph of errors over time
- **Session Timeline:** Interactive session explorer

---

## 🔧 Implementation Order

### Step 1: Foundation (Analytics First)
1. Create analytics database schema
2. Implement AnalyticsEngine
3. Integrate with orchestrator for event recording
4. Test analytics data collection

**Why first:** Enables data collection from day 1, informs all other features

### Step 2: Event System
1. Add EventEmitter to orchestrator
2. Emit events on tool execution
3. Test event emission and handling

### Step 3: Dashboard Backend
1. Implement Express server with Socket.io
2. Connect to orchestrator events
3. Implement REST API endpoints
4. Test WebSocket connectivity

### Step 4: Dashboard Frontend
1. Build HTML/CSS/JS interface
2. Implement real-time tool visualization
3. Add analytics charts
4. Test in browser

### Step 5: Plugin System
1. Design plugin interface
2. Implement plugin loader
3. Create example plugin
4. Test plugin loading and execution

### Step 6: Workflow Engine
1. Implement YAML parser
2. Build workflow execution engine
3. Add template variable resolution
4. Create example workflows
5. Test workflow execution

### Step 7: Integration & Testing
1. Write unit tests for all components
2. Write integration tests
3. Test all features together
4. Performance testing

### Step 8: Documentation & Demo
1. Update README
2. Create tutorial docs
3. Build comprehensive demo
4. Record demo video

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
// tests/unit/
├── analytics.test.ts
├── plugin-loader.test.ts
├── workflow-engine.test.ts
└── event-emitter.test.ts
```

### Integration Tests
```typescript
// tests/integration/
├── dashboard.test.ts
├── plugin-integration.test.ts
├── workflow-integration.test.ts
└── end-to-end.test.ts
```

### Test Framework: Vitest
- Fast, modern testing
- TypeScript support
- Easy mocking

---

## 📦 New Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "better-sqlite3": "^9.4.0",
    "yaml": "^2.3.4",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "@types/express": "^4.17.21",
    "@types/better-sqlite3": "^7.6.8",
    "supertest": "^6.3.4"
  }
}
```

---

## 🎯 Success Criteria

### Phase 1: Dashboard
- ✅ Real-time tool execution visible in browser
- ✅ All agent activity monitored
- ✅ Request/response history viewable
- ✅ Analytics charts functional

### Phase 2: Plugins
- ✅ Plugins auto-discovered from directory
- ✅ Example plugin working
- ✅ Plugin lifecycle hooks functional
- ✅ Plugins can add agents and tools

### Phase 3: Workflows
- ✅ YAML workflows execute successfully
- ✅ Template variables resolve correctly
- ✅ Dependency management works
- ✅ Error handling and retries functional

### Phase 4: Analytics
- ✅ All tool executions recorded
- ✅ Metrics queryable via API
- ✅ Dashboard displays live analytics
- ✅ Historical data retrievable

---

## 🚀 Deployment

### Development
```bash
npm run dev:dashboard    # Start dashboard on :3000
npm run demo:all         # Run comprehensive demo
```

### Production
```bash
npm run build            # Compile TypeScript
npm run start:dashboard  # Production server
```

---

## 📈 Version: 1.2.0

**Release Date:** TBD
**Code Name:** "Observatory" - because you can now observe everything!
