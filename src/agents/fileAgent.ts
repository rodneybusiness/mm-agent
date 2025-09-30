import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import * as crypto from 'crypto';
import { Agent, Tool, AgentResponse, AnthropicTool, FileReadSchema, FileWriteSchema, FileAnalyzeSchema } from '../types';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class FileManagementAgent implements Agent {
  name = 'File Management Agent';
  description = 'Handles file operations including reading, writing, analyzing, and managing files and directories';
  
  tools: Tool[] = [
    {
      name: 'read_file',
      description: 'Read contents of a file',
      schema: FileReadSchema,
      execute: this.readFile.bind(this)
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      schema: FileWriteSchema,
      execute: this.writeFile.bind(this)
    },
    {
      name: 'analyze_file',
      description: 'Analyze file structure, metadata, and content',
      schema: FileAnalyzeSchema,
      execute: this.analyzeFile.bind(this)
    },
    {
      name: 'list_files',
      description: 'List files in a directory with pattern matching',
      schema: FileReadSchema,
      execute: this.listFiles.bind(this)
    }
  ];

  async execute(input: string): Promise<AgentResponse> {
    try {
      // Parse the input to determine which tool to use
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
        metadata: { timestamp: new Date().toISOString() }
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
    // Smart parsing logic - could be enhanced with NLP
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('read') || lowerInput.includes('show') || lowerInput.includes('display')) {
      const pathMatch = input.match(/['"`]([^'"`]+)['"`]/) || input.match(/(\S+\.\w+)/);
      return {
        tool: 'read_file',
        params: { path: pathMatch?.[1] || input.split(' ').pop() }
      };
    }
    
    if (lowerInput.includes('write') || lowerInput.includes('save') || lowerInput.includes('create')) {
      return {
        tool: 'write_file',
        params: this.parseWriteParams(input)
      };
    }
    
    if (lowerInput.includes('analyze') || lowerInput.includes('inspect')) {
      const pathMatch = input.match(/['"`]([^'"`]+)['"`]/) || input.match(/(\S+\.\w+)/);
      return {
        tool: 'analyze_file',
        params: { path: pathMatch?.[1] || input.split(' ').pop() }
      };
    }
    
    if (lowerInput.includes('list') || lowerInput.includes('find') || lowerInput.includes('search')) {
      const pathMatch = input.match(/['"`]([^'"`]+)['"`]/) || input.match(/(\S+)/);
      return {
        tool: 'list_files',
        params: { path: pathMatch?.[1] || '.' }
      };
    }

    // Default to analyze
    return {
      tool: 'analyze_file',
      params: { path: input.trim() }
    };
  }

  private parseWriteParams(input: string): any {
    // Extract path and content from input
    const parts = input.split(' ');
    let path = '';
    let content = '';
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes('.') && !path) {
        path = parts[i];
        content = parts.slice(i + 1).join(' ');
        break;
      }
    }
    
    return { path: path || 'output.txt', content: content || input };
  }

  async readFile(params: any): Promise<any> {
    const { path: filePath, encoding = 'utf8' } = FileReadSchema.parse(params);
    
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory: ${filePath}`);
    }

    const content = await fs.readFile(filePath, encoding);
    const size = stats.size;
    const lines = content.split('\n').length;

    return {
      content,
      metadata: {
        path: filePath,
        size,
        lines,
        encoding,
        lastModified: stats.mtime,
        extension: path.extname(filePath)
      }
    };
  }

  async writeFile(params: any): Promise<any> {
    const { path: filePath, content, encoding = 'utf8' } = FileWriteSchema.parse(params);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.ensureDir(dir);
    
    // Create backup if file exists
    let backupPath = null;
    if (await fs.pathExists(filePath)) {
      backupPath = `${filePath}.backup-${Date.now()}`;
      await fs.copy(filePath, backupPath);
    }

    await fs.writeFile(filePath, content, encoding);
    const stats = await fs.stat(filePath);

    return {
      success: true,
      path: filePath,
      size: stats.size,
      lines: content.split('\n').length,
      backupPath,
      timestamp: new Date().toISOString()
    };
  }

  async analyzeFile(params: any): Promise<any> {
    const { path: filePath, analysisType = 'all' } = FileAnalyzeSchema.parse(params);
    
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = await fs.stat(filePath);
    const result: any = {
      path: filePath,
      exists: true,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };

    if (analysisType === 'metadata' || analysisType === 'all') {
      result.metadata = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        permissions: stats.mode.toString(8),
        extension: path.extname(filePath),
        directory: path.dirname(filePath),
        basename: path.basename(filePath)
      };
    }

    if (stats.isFile() && (analysisType === 'content' || analysisType === 'all')) {
      const content = await fs.readFile(filePath, 'utf8');
      result.content = {
        lines: content.split('\n').length,
        characters: content.length,
        words: content.split(/\s+/).length,
        isEmpty: content.trim().length === 0,
        encoding: 'utf8',
        hash: crypto.createHash('md5').update(content).digest('hex')
      };

      // Basic content analysis
      if (content.length < 10000) { // Only for smaller files
        result.content.preview = content.substring(0, 500);
        result.content.language = this.detectLanguage(filePath, content);
      }
    }

    if (stats.isDirectory() && (analysisType === 'structure' || analysisType === 'all')) {
      const files = await fs.readdir(filePath);
      result.structure = {
        fileCount: files.length,
        files: files.slice(0, 20), // Limit to first 20 files
        hasMore: files.length > 20
      };
    }

    return result;
  }

  async listFiles(params: any): Promise<any> {
    const { path: searchPath } = FileReadSchema.parse(params);
    
    // Use glob pattern matching
    const pattern = searchPath.includes('*') ? searchPath : path.join(searchPath, '**/*');
    const files = await glob(pattern, { 
      absolute: true,
      nodir: false,
      maxDepth: 5 // Prevent infinite recursion
    });

    const results = await Promise.all(
      files.slice(0, 100).map(async (filePath) => {
        const stats = await fs.stat(filePath);
        return {
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          isDirectory: stats.isDirectory(),
          modified: stats.mtime,
          extension: path.extname(filePath)
        };
      })
    );

    return {
      pattern: searchPath,
      totalFound: files.length,
      showing: Math.min(files.length, 100),
      files: results.sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  private detectLanguage(filePath: string, content: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.xml': 'xml',
      '.md': 'markdown',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.sql': 'sql',
      '.sh': 'bash',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby'
    };

    return languageMap[ext] || 'text';
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