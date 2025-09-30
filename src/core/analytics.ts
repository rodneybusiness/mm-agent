import Database from 'better-sqlite3';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface ToolExecutionEvent {
  sessionId: string;
  agentKey: string;
  toolName: string;
  startedAt: number;
  completedAt?: number;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
  inputSize?: number;
  outputSize?: number;
}

export interface SessionMetrics {
  totalTools: number;
  successCount: number;
  errorCount: number;
  finalResult?: any;
}

export interface ToolMetrics {
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  errorCount: number;
  mostUsedTools: Array<{name: string; count: number; avgDuration: number}>;
}

export interface AgentMetrics {
  agentKey: string;
  totalSessions: number;
  totalExecutions: number;
  averageToolsPerSession: number;
  successRate: number;
  averageDuration: number;
  popularTools: Array<{name: string; count: number}>;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface WorkflowMetrics {
  workflowName: string;
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  lastExecuted: number;
}

export class AnalyticsEngine {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = path.join(process.cwd(), 'data', 'analytics.db')) {
    this.dbPath = dbPath;
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    fs.ensureDirSync(path.dirname(this.dbPath));
    
    this.db = new Database(this.dbPath);
    
    const schemaPath = path.join(process.cwd(), 'data', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(schema);
    } else {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
  }

  async recordToolExecution(event: ToolExecutionEvent): Promise<void> {
    const durationMs = event.completedAt 
      ? event.completedAt - event.startedAt 
      : null;

    const stmt = this.db.prepare(`
      INSERT INTO tool_executions 
      (session_id, agent_key, tool_name, started_at, completed_at, duration_ms, status, error_message, input_size, output_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.sessionId,
      event.agentKey,
      event.toolName,
      event.startedAt,
      event.completedAt || null,
      durationMs,
      event.status,
      event.errorMessage || null,
      event.inputSize || null,
      event.outputSize || null
    );
  }

  async recordSessionStart(sessionId: string, agentKey: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO agent_sessions (session_id, agent_key, started_at)
      VALUES (?, ?, ?)
    `);

    stmt.run(sessionId, agentKey, Date.now());
  }

  async recordSessionEnd(sessionId: string, metrics: SessionMetrics): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE agent_sessions 
      SET completed_at = ?, total_tools = ?, success_count = ?, error_count = ?, final_result = ?
      WHERE session_id = ?
    `);

    stmt.run(
      Date.now(),
      metrics.totalTools,
      metrics.successCount,
      metrics.errorCount,
      metrics.finalResult ? JSON.stringify(metrics.finalResult) : null,
      sessionId
    );
  }

  async getToolMetrics(timeRange?: TimeRange): Promise<ToolMetrics> {
    let whereClause = '';
    const params: any[] = [];

    if (timeRange) {
      whereClause = 'WHERE started_at >= ? AND started_at <= ?';
      params.push(timeRange.start, timeRange.end);
    }

    const totalQuery = `SELECT COUNT(*) as count FROM tool_executions ${whereClause}`;
    const total = this.db.prepare(totalQuery).get(...params) as {count: number};

    const successQuery = `
      SELECT COUNT(*) as count FROM tool_executions 
      ${whereClause}${whereClause ? ' AND' : 'WHERE'} status = 'success'
    `;
    const success = this.db.prepare(successQuery).get(...params) as {count: number};

    const avgDurationQuery = `
      SELECT AVG(duration_ms) as avg FROM tool_executions 
      ${whereClause}${whereClause ? ' AND' : 'WHERE'} duration_ms IS NOT NULL
    `;
    const avgDuration = this.db.prepare(avgDurationQuery).get(...params) as {avg: number};

    const errorQuery = `
      SELECT COUNT(*) as count FROM tool_executions 
      ${whereClause}${whereClause ? ' AND' : 'WHERE'} status = 'error'
    `;
    const errors = this.db.prepare(errorQuery).get(...params) as {count: number};

    const topToolsQuery = `
      SELECT tool_name, COUNT(*) as count, AVG(duration_ms) as avgDuration
      FROM tool_executions
      ${whereClause}
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 10
    `;
    const topTools = this.db.prepare(topToolsQuery).all(...params) as Array<{tool_name: string; count: number; avgDuration: number}>;

    return {
      totalExecutions: total.count,
      successRate: total.count > 0 ? (success.count / total.count) * 100 : 0,
      averageDuration: avgDuration.avg || 0,
      errorCount: errors.count,
      mostUsedTools: topTools.map(t => ({
        name: t.tool_name,
        count: t.count,
        avgDuration: t.avgDuration || 0
      }))
    };
  }

  async getAgentMetrics(agentKey: string, timeRange?: TimeRange): Promise<AgentMetrics> {
    let whereClause = 'WHERE agent_key = ?';
    const params: any[] = [agentKey];

    if (timeRange) {
      whereClause += ' AND started_at >= ? AND started_at <= ?';
      params.push(timeRange.start, timeRange.end);
    }

    const sessionsQuery = `SELECT COUNT(*) as count FROM agent_sessions ${whereClause}`;
    const sessions = this.db.prepare(sessionsQuery).get(...params) as {count: number};

    const executionsQuery = `SELECT COUNT(*) as count FROM tool_executions ${whereClause}`;
    const executions = this.db.prepare(executionsQuery).get(...params) as {count: number};

    const successQuery = `
      SELECT COUNT(*) as count FROM tool_executions 
      ${whereClause} AND status = 'success'
    `;
    const success = this.db.prepare(successQuery).get(...params) as {count: number};

    const avgDurationQuery = `
      SELECT AVG(duration_ms) as avg FROM tool_executions 
      ${whereClause} AND duration_ms IS NOT NULL
    `;
    const avgDuration = this.db.prepare(avgDurationQuery).get(...params) as {avg: number};

    const popularToolsQuery = `
      SELECT tool_name, COUNT(*) as count
      FROM tool_executions
      ${whereClause}
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 5
    `;
    const popularTools = this.db.prepare(popularToolsQuery).all(...params) as Array<{tool_name: string; count: number}>;

    return {
      agentKey,
      totalSessions: sessions.count,
      totalExecutions: executions.count,
      averageToolsPerSession: sessions.count > 0 ? executions.count / sessions.count : 0,
      successRate: executions.count > 0 ? (success.count / executions.count) * 100 : 0,
      averageDuration: avgDuration.avg || 0,
      popularTools: popularTools.map(t => ({name: t.tool_name, count: t.count}))
    };
  }

  async getTopTools(limit: number = 10): Promise<Array<{name: string; count: number; successRate: number}>> {
    const query = `
      SELECT 
        tool_name,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes
      FROM tool_executions
      GROUP BY tool_name
      ORDER BY total DESC
      LIMIT ?
    `;

    const results = this.db.prepare(query).all(limit) as Array<{tool_name: string; total: number; successes: number}>;

    return results.map(r => ({
      name: r.tool_name,
      count: r.total,
      successRate: r.total > 0 ? (r.successes / r.total) * 100 : 0
    }));
  }

  async getErrorRate(timeRange?: TimeRange): Promise<number> {
    let whereClause = '';
    const params: any[] = [];

    if (timeRange) {
      whereClause = 'WHERE started_at >= ? AND started_at <= ?';
      params.push(timeRange.start, timeRange.end);
    }

    const totalQuery = `SELECT COUNT(*) as count FROM tool_executions ${whereClause}`;
    const total = this.db.prepare(totalQuery).get(...params) as {count: number};

    const errorQuery = `
      SELECT COUNT(*) as count FROM tool_executions 
      ${whereClause}${whereClause ? ' AND' : 'WHERE'} status = 'error'
    `;
    const errors = this.db.prepare(errorQuery).get(...params) as {count: number};

    return total.count > 0 ? (errors.count / total.count) * 100 : 0;
  }

  async getSessionHistory(limit: number = 50): Promise<any[]> {
    const query = `
      SELECT * FROM agent_sessions
      ORDER BY started_at DESC
      LIMIT ?
    `;

    return this.db.prepare(query).all(limit) as any[];
  }

  async getRecentExecutions(limit: number = 100): Promise<any[]> {
    const query = `
      SELECT * FROM tool_executions
      ORDER BY started_at DESC
      LIMIT ?
    `;

    return this.db.prepare(query).all(limit) as any[];
  }

  async recordWorkflowExecution(data: {
    workflowName: string;
    workflowVersion?: string;
    startedAt: number;
    completedAt: number;
    status: 'success' | 'error' | 'timeout';
    inputs?: any;
    outputs?: any;
    errorMessage?: string;
  }): Promise<void> {
    const durationMs = data.completedAt - data.startedAt;

    const stmt = this.db.prepare(`
      INSERT INTO workflow_executions 
      (workflow_name, workflow_version, started_at, completed_at, duration_ms, status, inputs, outputs, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.workflowName,
      data.workflowVersion || null,
      data.startedAt,
      data.completedAt,
      durationMs,
      data.status,
      data.inputs ? JSON.stringify(data.inputs) : null,
      data.outputs ? JSON.stringify(data.outputs) : null,
      data.errorMessage || null
    );
  }

  async getWorkflowMetrics(workflowName?: string): Promise<WorkflowMetrics[]> {
    let whereClause = '';
    const params: any[] = [];

    if (workflowName) {
      whereClause = 'WHERE workflow_name = ?';
      params.push(workflowName);
    }

    const query = `
      SELECT 
        workflow_name,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes,
        AVG(duration_ms) as avgDuration,
        MAX(started_at) as lastExecuted
      FROM workflow_executions
      ${whereClause}
      GROUP BY workflow_name
      ORDER BY lastExecuted DESC
    `;

    const results = this.db.prepare(query).all(...params) as Array<{
      workflow_name: string;
      total: number;
      successes: number;
      avgDuration: number;
      lastExecuted: number;
    }>;

    return results.map(r => ({
      workflowName: r.workflow_name,
      totalExecutions: r.total,
      successRate: r.total > 0 ? (r.successes / r.total) * 100 : 0,
      averageDuration: r.avgDuration || 0,
      lastExecuted: r.lastExecuted
    }));
  }

  close(): void {
    this.db.close();
  }
}
