import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { Agent, Tool, AgentResponse, AnthropicTool, CodeAnalyzeSchema, CodeSuggestionSchema } from '../types';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class CodeAnalysisAgent implements Agent {
  name = 'Code Analysis Agent';
  description = 'Analyzes codebases, suggests improvements, generates documentation, and provides code insights';
  
  tools: Tool[] = [
    {
      name: 'analyze_code',
      description: 'Analyze code structure, complexity, and quality',
      schema: CodeAnalyzeSchema,
      execute: this.analyzeCode.bind(this)
    },
    {
      name: 'suggest_improvements',
      description: 'Suggest code improvements and best practices',
      schema: CodeSuggestionSchema,
      execute: this.suggestImprovements.bind(this)
    },
    {
      name: 'analyze_dependencies',
      description: 'Analyze project dependencies and imports',
      schema: CodeAnalyzeSchema,
      execute: this.analyzeDependencies.bind(this)
    },
    {
      name: 'security_scan',
      description: 'Scan code for potential security issues',
      schema: CodeAnalyzeSchema,
      execute: this.securityScan.bind(this)
    },
    {
      name: 'generate_docs',
      description: 'Generate documentation for code',
      schema: CodeAnalyzeSchema,
      execute: this.generateDocs.bind(this)
    }
  ];

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
          path: parsed.params.path 
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
    
    if (lowerInput.includes('security') || lowerInput.includes('vulnerability')) {
      return {
        tool: 'security_scan',
        params: { path: this.extractPath(input), analysisType: 'security' }
      };
    }
    
    if (lowerInput.includes('dependencies') || lowerInput.includes('imports')) {
      return {
        tool: 'analyze_dependencies',
        params: { path: this.extractPath(input), analysisType: 'dependencies' }
      };
    }
    
    if (lowerInput.includes('improve') || lowerInput.includes('suggest')) {
      return {
        tool: 'suggest_improvements',
        params: { 
          code: input.includes('```') ? this.extractCodeBlock(input) : '',
          language: this.detectLanguageFromInput(input),
          focusArea: 'all' as const
        }
      };
    }
    
    if (lowerInput.includes('docs') || lowerInput.includes('documentation')) {
      return {
        tool: 'generate_docs',
        params: { path: this.extractPath(input), analysisType: 'all' }
      };
    }
    
    // Default to code analysis
    return {
      tool: 'analyze_code',
      params: { path: this.extractPath(input), analysisType: 'all' }
    };
  }

  private extractPath(input: string): string {
    const pathMatch = input.match(/['"`]([^'"`]+)['"`]/) || input.match(/(\S+\.[a-zA-Z]+)/);
    return pathMatch?.[1] || input.split(' ').pop() || '.';
  }

  private extractCodeBlock(input: string): string {
    const codeMatch = input.match(/```[\s\S]*?\n([\s\S]*?)```/);
    return codeMatch?.[1] || '';
  }

  private detectLanguageFromInput(input: string): string {
    const languageKeywords = {
      javascript: ['javascript', 'js', 'node', 'npm'],
      typescript: ['typescript', 'ts'],
      python: ['python', 'py', 'pip'],
      java: ['java'],
      csharp: ['c#', 'csharp', 'dotnet'],
      cpp: ['c++', 'cpp'],
      go: ['go', 'golang'],
      rust: ['rust', 'cargo'],
      php: ['php'],
      ruby: ['ruby', 'rb']
    };

    const lowerInput = input.toLowerCase();
    for (const [lang, keywords] of Object.entries(languageKeywords)) {
      if (keywords.some(keyword => lowerInput.includes(keyword))) {
        return lang;
      }
    }

    return 'unknown';
  }

  async analyzeCode(params: any): Promise<any> {
    const { path: codePath, language, analysisType = 'all' } = CodeAnalyzeSchema.parse(params);
    
    if (!await fs.pathExists(codePath)) {
      throw new Error(`Path not found: ${codePath}`);
    }

    const stats = await fs.stat(codePath);
    const result: any = {
      path: codePath,
      analysisType,
      timestamp: new Date().toISOString()
    };

    if (stats.isFile()) {
      result.fileAnalysis = await this.analyzeFile(codePath, language);
    } else if (stats.isDirectory()) {
      result.projectAnalysis = await this.analyzeProject(codePath);
    }

    return result;
  }

  private async analyzeFile(filePath: string, language?: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    const detectedLanguage = language || this.detectLanguage(ext);

    const analysis = {
      file: filePath,
      language: detectedLanguage,
      size: content.length,
      lines: content.split('\n').length,
      blankLines: content.split('\n').filter(line => line.trim() === '').length,
      codeLines: 0,
      commentLines: 0,
      functions: 0,
      classes: 0,
      complexity: 0,
      imports: [] as string[],
      exports: [] as string[],
      issues: [] as any[]
    };

    // Language-specific analysis
    switch (detectedLanguage) {
      case 'javascript':
      case 'typescript':
        this.analyzeJavaScript(content, analysis);
        break;
      case 'python':
        this.analyzePython(content, analysis);
        break;
      case 'java':
        this.analyzeJava(content, analysis);
        break;
      default:
        this.analyzeGeneric(content, analysis);
    }

    return analysis;
  }

  private async analyzeProject(projectPath: string): Promise<any> {
    const files = await glob(path.join(projectPath, '**/*'), {
      nodir: true,
      maxDepth: 10
    });

    const codeFiles = files.filter(file => this.isCodeFile(file));
    const analysis = {
      path: projectPath,
      totalFiles: files.length,
      codeFiles: codeFiles.length,
      languages: new Set<string>(),
      totalLines: 0,
      totalSize: 0,
      fileBreakdown: {} as Record<string, number>,
      dependencies: new Set<string>(),
      structure: this.analyzeProjectStructure(projectPath),
      metrics: {
        complexity: 0,
        maintainabilityIndex: 0,
        testCoverage: 'unknown'
      }
    };

    for (const file of codeFiles.slice(0, 50)) { // Limit to 50 files for performance
      const stats = await fs.stat(file);
      const ext = path.extname(file).toLowerCase();
      const language = this.detectLanguage(ext);
      
      analysis.languages.add(language);
      analysis.totalSize += stats.size;
      analysis.fileBreakdown[ext] = (analysis.fileBreakdown[ext] || 0) + 1;

      try {
        const content = await fs.readFile(file, 'utf8');
        analysis.totalLines += content.split('\n').length;
        
        // Extract dependencies
        const deps = this.extractDependencies(content, language);
        deps.forEach(dep => analysis.dependencies.add(dep));
      } catch {
        // Skip files that can't be read
      }
    }

    return {
      ...analysis,
      languages: Array.from(analysis.languages),
      dependencies: Array.from(analysis.dependencies)
    };
  }

  private analyzeJavaScript(content: string, analysis: any): void {
    // Count functions
    const functionMatches = content.match(/function\s+\w+|=>\s*{|class\s+\w+/g);
    analysis.functions = functionMatches?.length || 0;

    // Count classes
    const classMatches = content.match(/class\s+\w+/g);
    analysis.classes = classMatches?.length || 0;

    // Extract imports
    const importMatches = content.match(/import\s+.*?from\s+['"`](.*?)['"`]/g);
    analysis.imports = importMatches?.map(match => {
      const moduleMatch = match.match(/from\s+['"`](.*?)['"`]/);
      return moduleMatch?.[1] || '';
    }) || [];

    // Extract exports
    const exportMatches = content.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g);
    analysis.exports = exportMatches?.map(match => {
      const nameMatch = match.match(/\w+$/);
      return nameMatch?.[0] || '';
    }) || [];

    // Simple complexity calculation (cyclomatic complexity approximation)
    const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||'];
    analysis.complexity = complexityKeywords.reduce((sum, keyword) => {
      const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      return sum + (matches?.length || 0);
    }, 1);

    // Count comments
    const commentMatches = content.match(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm);
    analysis.commentLines = commentMatches?.length || 0;
    analysis.codeLines = analysis.lines - analysis.blankLines - analysis.commentLines;

    // Basic issue detection
    this.detectCommonIssues(content, analysis, 'javascript');
  }

  private analyzePython(content: string, analysis: any): void {
    // Count functions and classes
    const functionMatches = content.match(/def\s+\w+/g);
    analysis.functions = functionMatches?.length || 0;

    const classMatches = content.match(/class\s+\w+/g);
    analysis.classes = classMatches?.length || 0;

    // Extract imports
    const importMatches = content.match(/(?:from\s+(\S+)\s+import|import\s+(\S+))/g);
    analysis.imports = importMatches?.map(match => {
      const fromMatch = match.match(/from\s+(\S+)\s+import/);
      const importMatch = match.match(/import\s+(\S+)/);
      return fromMatch?.[1] || importMatch?.[1] || '';
    }) || [];

    // Count comments
    const commentMatches = content.match(/#.*$/gm);
    analysis.commentLines = commentMatches?.length || 0;
    analysis.codeLines = analysis.lines - analysis.blankLines - analysis.commentLines;

    this.detectCommonIssues(content, analysis, 'python');
  }

  private analyzeJava(content: string, analysis: any): void {
    // Count methods and classes
    const methodMatches = content.match(/(?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\(/g);
    analysis.functions = methodMatches?.length || 0;

    const classMatches = content.match(/(?:public\s+)?class\s+\w+/g);
    analysis.classes = classMatches?.length || 0;

    // Extract imports
    const importMatches = content.match(/import\s+([^;]+);/g);
    analysis.imports = importMatches?.map(match => {
      const importMatch = match.match(/import\s+([^;]+);/);
      return importMatch?.[1] || '';
    }) || [];

    this.detectCommonIssues(content, analysis, 'java');
  }

  private analyzeGeneric(content: string, analysis: any): void {
    // Basic line counting
    const lines = content.split('\n');
    analysis.codeLines = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    analysis.commentLines = lines.filter(line => line.trim().startsWith('//')).length;
  }

  private detectCommonIssues(content: string, analysis: any, language: string): void {
    const issues: any[] = [];

    // Common issues across languages
    if (content.includes('TODO')) {
      issues.push({ type: 'todo', message: 'Contains TODO comments', severity: 'info' });
    }

    if (content.includes('FIXME')) {
      issues.push({ type: 'fixme', message: 'Contains FIXME comments', severity: 'warning' });
    }

    // Language-specific issues
    if (language === 'javascript' || language === 'typescript') {
      if (content.includes('console.log')) {
        issues.push({ type: 'debug', message: 'Contains console.log statements', severity: 'info' });
      }
      if (content.includes('var ')) {
        issues.push({ type: 'best-practice', message: 'Uses var instead of let/const', severity: 'warning' });
      }
      if (content.includes('== ') && !content.includes('=== ')) {
        issues.push({ type: 'best-practice', message: 'Uses loose equality (==)', severity: 'warning' });
      }
    }

    if (language === 'python') {
      if (content.includes('print(')) {
        issues.push({ type: 'debug', message: 'Contains print statements', severity: 'info' });
      }
      if (!content.includes('"""') && !content.includes("'''")) {
        issues.push({ type: 'documentation', message: 'Missing docstrings', severity: 'info' });
      }
    }

    analysis.issues = issues;
  }

  private extractDependencies(content: string, language: string): string[] {
    const deps: string[] = [];

    switch (language) {
      case 'javascript':
      case 'typescript':
        const jsImports = content.match(/(?:import.*?from\s+['"`](.*?)['"`]|require\(['"`](.*?)['"`]\))/g);
        if (jsImports) {
          deps.push(...jsImports.map(imp => {
            const match = imp.match(/['"`](.*?)['"`]/);
            return match?.[1] || '';
          }).filter(Boolean));
        }
        break;
      
      case 'python':
        const pyImports = content.match(/(?:from\s+(\S+)\s+import|import\s+(\S+))/g);
        if (pyImports) {
          deps.push(...pyImports.map(imp => {
            const fromMatch = imp.match(/from\s+(\S+)\s+import/);
            const importMatch = imp.match(/import\s+(\S+)/);
            return fromMatch?.[1] || importMatch?.[1] || '';
          }).filter(Boolean));
        }
        break;
    }

    return deps;
  }

  async suggestImprovements(params: any): Promise<any> {
    const { code, language, focusArea } = CodeSuggestionSchema.parse(params);
    
    const suggestions: any[] = [];
    const metrics = {
      readability: 0,
      performance: 0,
      security: 0,
      maintainability: 0
    };

    // Analyze code and generate suggestions based on language and focus area
    if (language === 'javascript' || language === 'typescript') {
      this.analyzeJSForImprovements(code, suggestions, metrics);
    } else if (language === 'python') {
      this.analyzePythonForImprovements(code, suggestions, metrics);
    }

    // Generic improvements
    this.analyzeGenericForImprovements(code, suggestions, metrics);

    return {
      language,
      focusArea,
      metrics,
      suggestions,
      overallScore: (metrics.readability + metrics.performance + metrics.security + metrics.maintainability) / 4,
      timestamp: new Date().toISOString()
    };
  }

  private analyzeJSForImprovements(code: string, suggestions: any[], metrics: any): void {
    // Performance suggestions
    if (code.includes('for (') && code.includes('.length')) {
      suggestions.push({
        type: 'performance',
        priority: 'medium',
        title: 'Cache array length in loops',
        description: 'Store array.length in a variable to avoid repeated property access',
        example: 'for (let i = 0, len = array.length; i < len; i++)'
      });
      metrics.performance += 20;
    }

    // Security suggestions
    if (code.includes('innerHTML')) {
      suggestions.push({
        type: 'security',
        priority: 'high',
        title: 'Avoid innerHTML for security',
        description: 'Use textContent or createElement to prevent XSS attacks',
        example: 'element.textContent = userInput;'
      });
      metrics.security -= 30;
    }

    // Readability suggestions
    if (code.split('\n').some(line => line.length > 120)) {
      suggestions.push({
        type: 'readability',
        priority: 'low',
        title: 'Long lines detected',
        description: 'Consider breaking long lines for better readability',
        example: 'Break at 80-100 characters per line'
      });
      metrics.readability -= 10;
    }

    metrics.readability = Math.max(0, Math.min(100, metrics.readability + 70));
    metrics.performance = Math.max(0, Math.min(100, metrics.performance + 75));
    metrics.security = Math.max(0, Math.min(100, metrics.security + 80));
    metrics.maintainability = Math.max(0, Math.min(100, 85 - (code.split('\n').length / 10)));
  }

  private analyzePythonForImprovements(code: string, suggestions: any[], metrics: any): void {
    // Python-specific suggestions
    if (code.includes('except:')) {
      suggestions.push({
        type: 'best-practice',
        priority: 'high',
        title: 'Avoid bare except clauses',
        description: 'Catch specific exceptions instead of using bare except',
        example: 'except ValueError as e:'
      });
      metrics.maintainability -= 20;
    }

    if (code.includes('import *')) {
      suggestions.push({
        type: 'best-practice',
        priority: 'medium',
        title: 'Avoid wildcard imports',
        description: 'Import specific functions/classes to avoid namespace pollution',
        example: 'from module import specific_function'
      });
      metrics.maintainability -= 15;
    }

    metrics.readability = Math.max(0, Math.min(100, 75));
    metrics.performance = Math.max(0, Math.min(100, 80));
    metrics.security = Math.max(0, Math.min(100, 85));
    metrics.maintainability = Math.max(0, Math.min(100, metrics.maintainability + 90));
  }

  private analyzeGenericForImprovements(code: string, suggestions: any[], metrics: any): void {
    // Generic code quality checks
    const lines = code.split('\n');
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
    
    if (avgLineLength > 100) {
      suggestions.push({
        type: 'readability',
        priority: 'medium',
        title: 'High average line length',
        description: 'Consider breaking down complex expressions',
        example: 'Use intermediate variables or method chaining'
      });
    }

    // Check for code duplication (simple heuristic)
    const uniqueLines = new Set(lines.map(line => line.trim()).filter(line => line.length > 10));
    const duplicationRatio = (lines.length - uniqueLines.size) / lines.length;
    
    if (duplicationRatio > 0.3) {
      suggestions.push({
        type: 'maintainability',
        priority: 'high',
        title: 'Potential code duplication',
        description: 'Consider extracting common code into functions or classes',
        example: 'Create reusable functions for repeated logic'
      });
    }
  }

  async analyzeDependencies(params: any): Promise<any> {
    const { path: projectPath } = CodeAnalyzeSchema.parse(params);
    
    const dependencies = {
      direct: [] as any[],
      dev: [] as any[],
      peer: [] as any[],
      bundled: [] as any[],
      security: [] as any[],
      outdated: [] as any[]
    };

    // Check for package.json (Node.js)
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      Object.entries(packageJson.dependencies || {}).forEach(([name, version]) => {
        dependencies.direct.push({ name, version, type: 'runtime' });
      });
      
      Object.entries(packageJson.devDependencies || {}).forEach(([name, version]) => {
        dependencies.dev.push({ name, version, type: 'development' });
      });
    }

    // Check for requirements.txt (Python)
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (await fs.pathExists(requirementsPath)) {
      const requirements = await fs.readFile(requirementsPath, 'utf8');
      requirements.split('\n').forEach(line => {
        const match = line.trim().match(/^([^>=<]+)([>=<].*)?$/);
        if (match) {
          dependencies.direct.push({ 
            name: match[1], 
            version: match[2] || 'latest', 
            type: 'runtime' 
          });
        }
      });
    }

    return {
      path: projectPath,
      totalDependencies: dependencies.direct.length + dependencies.dev.length,
      dependencies,
      analysis: {
        riskLevel: this.calculateDependencyRisk(dependencies),
        recommendations: this.generateDependencyRecommendations(dependencies)
      },
      timestamp: new Date().toISOString()
    };
  }

  private calculateDependencyRisk(dependencies: any): string {
    const total = dependencies.direct.length + dependencies.dev.length;
    if (total > 100) return 'high';
    if (total > 50) return 'medium';
    return 'low';
  }

  private generateDependencyRecommendations(dependencies: any): string[] {
    const recommendations: string[] = [];
    
    if (dependencies.direct.length > 50) {
      recommendations.push('Consider reducing the number of direct dependencies');
    }
    
    if (dependencies.dev.length > dependencies.direct.length * 2) {
      recommendations.push('High ratio of dev dependencies to runtime dependencies');
    }
    
    recommendations.push('Regularly audit dependencies for security vulnerabilities');
    recommendations.push('Keep dependencies up to date');
    
    return recommendations;
  }

  async securityScan(params: any): Promise<any> {
    const { path: codePath } = CodeAnalyzeSchema.parse(params);
    
    const securityIssues: any[] = [];
    const codeFiles = await glob(path.join(codePath, '**/*.{js,ts,py,java,php,rb}'), {
      nodir: true
    });

    for (const file of codeFiles.slice(0, 20)) {
      const content = await fs.readFile(file, 'utf8');
      const fileIssues = this.scanFileForSecurity(content, file);
      securityIssues.push(...fileIssues);
    }

    return {
      path: codePath,
      scannedFiles: Math.min(codeFiles.length, 20),
      totalFiles: codeFiles.length,
      securityIssues,
      riskLevel: this.calculateSecurityRisk(securityIssues),
      recommendations: this.generateSecurityRecommendations(securityIssues),
      timestamp: new Date().toISOString()
    };
  }

  private scanFileForSecurity(content: string, filePath: string): any[] {
    const issues: any[] = [];
    const fileName = path.basename(filePath);
    
    // Common security patterns
    const securityPatterns = [
      { 
        pattern: /password\s*=\s*['"].*['"];?/i, 
        type: 'hardcoded-secret', 
        severity: 'high',
        message: 'Hardcoded password detected' 
      },
      { 
        pattern: /api[_-]?key\s*=\s*['"].*['"];?/i, 
        type: 'hardcoded-secret', 
        severity: 'high',
        message: 'Hardcoded API key detected' 
      },
      { 
        pattern: /eval\s*\(/i, 
        type: 'code-injection', 
        severity: 'high',
        message: 'Dangerous eval() usage' 
      },
      { 
        pattern: /innerHTML\s*=/i, 
        type: 'xss-risk', 
        severity: 'medium',
        message: 'Potential XSS risk with innerHTML' 
      },
      { 
        pattern: /document\.write\s*\(/i, 
        type: 'xss-risk', 
        severity: 'high',
        message: 'Dangerous document.write usage' 
      }
    ];

    securityPatterns.forEach(({ pattern, type, severity, message }) => {
      const matches = content.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        issues.push({
          file: fileName,
          type,
          severity,
          message,
          occurrences: matches.length,
          lines: this.findLineNumbers(content, pattern)
        });
      }
    });

    return issues;
  }

  private findLineNumbers(content: string, pattern: RegExp): number[] {
    const lines = content.split('\n');
    const lineNumbers: number[] = [];
    
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        lineNumbers.push(index + 1);
      }
    });
    
    return lineNumbers;
  }

  private calculateSecurityRisk(issues: any[]): string {
    const highSeverity = issues.filter(i => i.severity === 'high').length;
    const mediumSeverity = issues.filter(i => i.severity === 'medium').length;
    
    if (highSeverity > 0) return 'high';
    if (mediumSeverity > 3) return 'medium';
    return 'low';
  }

  private generateSecurityRecommendations(issues: any[]): string[] {
    const recommendations = [
      'Use environment variables for sensitive data',
      'Implement proper input validation and sanitization',
      'Use parameterized queries to prevent SQL injection',
      'Enable Content Security Policy (CSP)',
      'Regularly update dependencies to patch vulnerabilities'
    ];

    if (issues.some(i => i.type === 'hardcoded-secret')) {
      recommendations.unshift('Remove hardcoded secrets and use secure configuration');
    }

    if (issues.some(i => i.type === 'xss-risk')) {
      recommendations.unshift('Implement XSS protection measures');
    }

    return recommendations;
  }

  async generateDocs(params: any): Promise<any> {
    const { path: codePath } = CodeAnalyzeSchema.parse(params);
    
    if (!await fs.pathExists(codePath)) {
      throw new Error(`Path not found: ${codePath}`);
    }

    const stats = await fs.stat(codePath);
    let documentation: any = {};

    if (stats.isFile()) {
      documentation = await this.generateFileDocumentation(codePath);
    } else {
      documentation = await this.generateProjectDocumentation(codePath);
    }

    return {
      path: codePath,
      documentation,
      timestamp: new Date().toISOString()
    };
  }

  private async generateFileDocumentation(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf8');
    const analysis = await this.analyzeFile(filePath);
    
    return {
      file: filePath,
      overview: `${path.basename(filePath)} - ${analysis.language} file with ${analysis.lines} lines`,
      functions: analysis.functions,
      classes: analysis.classes,
      imports: analysis.imports,
      exports: analysis.exports,
      complexity: analysis.complexity,
      suggestedDocumentation: this.generateFileDocSuggestions(content, analysis)
    };
  }

  private async generateProjectDocumentation(projectPath: string): Promise<any> {
    const analysis = await this.analyzeProject(projectPath);
    
    return {
      project: projectPath,
      overview: `Project with ${analysis.codeFiles} code files in ${Array.from(analysis.languages).join(', ')}`,
      structure: analysis.structure,
      languages: analysis.languages,
      dependencies: Array.from(analysis.dependencies),
      metrics: analysis.metrics,
      suggestedSections: [
        'Installation',
        'Usage',
        'API Reference',
        'Contributing',
        'License'
      ]
    };
  }

  private generateFileDocSuggestions(content: string, analysis: any): string[] {
    const suggestions: string[] = [];
    
    if (analysis.functions > 0) {
      suggestions.push(`Add JSDoc comments for ${analysis.functions} functions`);
    }
    
    if (analysis.classes > 0) {
      suggestions.push(`Document ${analysis.classes} classes with their purpose and usage`);
    }
    
    if (analysis.complexity > 10) {
      suggestions.push('Add inline comments for complex logic');
    }
    
    if (analysis.exports.length > 0) {
      suggestions.push('Document exported functions and classes');
    }
    
    return suggestions;
  }

  private analyzeProjectStructure(projectPath: string): any {
    // This would be expanded to analyze actual project structure
    return {
      type: 'detected from files',
      hasTests: false,
      hasDocs: false,
      hasConfig: true
    };
  }

  private detectLanguage(ext: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust'
    };

    return languageMap[ext] || 'unknown';
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs'];
    return codeExtensions.includes(path.extname(filePath).toLowerCase());
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