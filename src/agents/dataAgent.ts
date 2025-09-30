import * as fs from 'fs-extra';
import * as csv from 'fast-csv';
import * as path from 'path';
import * as pdfParse from 'pdf-parse';
import { Agent, Tool, AgentResponse, AnthropicTool, CsvProcessSchema, JsonProcessSchema } from '../types';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class DataProcessingAgent implements Agent {
  name = 'Data Processing Agent';
  description = 'Processes CSV, JSON, and other data formats with transformation, analysis, and export capabilities';
  
  tools: Tool[] = [
    {
      name: 'process_csv',
      description: 'Process CSV files with reading, transformation, and analysis',
      schema: CsvProcessSchema,
      execute: this.processCsv.bind(this)
    },
    {
      name: 'process_json',
      description: 'Process JSON data with parsing, validation, and querying',
      schema: JsonProcessSchema,
      execute: this.processJson.bind(this)
    },
    {
      name: 'convert_data',
      description: 'Convert data between different formats',
      schema: CsvProcessSchema,
      execute: this.convertData.bind(this)
    },
    {
      name: 'analyze_data',
      description: 'Perform statistical analysis on data',
      schema: CsvProcessSchema,
      execute: this.analyzeData.bind(this)
    },
    {
      name: 'process_pdf',
      description: 'Extract text and data from PDF files',
      schema: CsvProcessSchema,
      execute: this.processPdf.bind(this)
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
          filePath: parsed.params.filePath || parsed.params.data 
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
    const filePath = this.extractFilePath(input);
    
    if (lowerInput.includes('pdf') || filePath.endsWith('.pdf')) {
      return {
        tool: 'process_pdf',
        params: { filePath, operation: 'read' }
      };
    }
    
    if (lowerInput.includes('csv') || filePath.endsWith('.csv')) {
      const operation = this.detectOperation(lowerInput);
      return {
        tool: 'process_csv',
        params: { filePath, operation }
      };
    }
    
    if (lowerInput.includes('json') || filePath.endsWith('.json') || input.includes('{')) {
      const operation = this.detectOperation(lowerInput);
      return {
        tool: 'process_json',
        params: { 
          data: input.includes('{') ? input : filePath,
          operation 
        }
      };
    }
    
    if (lowerInput.includes('convert') || lowerInput.includes('transform')) {
      return {
        tool: 'convert_data',
        params: { filePath, operation: 'transform' }
      };
    }
    
    if (lowerInput.includes('analyze') || lowerInput.includes('statistics') || lowerInput.includes('stats')) {
      return {
        tool: 'analyze_data',
        params: { filePath, operation: 'analyze' }
      };
    }
    
    // Default to CSV processing
    return {
      tool: 'process_csv',
      params: { filePath, operation: 'read' }
    };
  }

  private extractFilePath(input: string): string {
    const pathMatch = input.match(/['"`]([^'"`]+\.[a-zA-Z]+)['"`]/) || 
                     input.match(/(\S+\.[a-zA-Z]+)/);
    return pathMatch?.[1] || input.split(' ').find(part => part.includes('.')) || '';
  }

  private detectOperation(input: string): 'read' | 'transform' | 'analyze' {
    if (input.includes('transform') || input.includes('modify') || input.includes('filter')) {
      return 'transform';
    }
    if (input.includes('analyze') || input.includes('statistics') || input.includes('summary')) {
      return 'analyze';
    }
    return 'read';
  }

  async processCsv(params: any): Promise<any> {
    const { filePath, operation = 'read', transformConfig } = CsvProcessSchema.parse(params);
    
    if (!await fs.pathExists(filePath)) {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    const result: any = {
      filePath,
      operation,
      timestamp: new Date().toISOString()
    };

    switch (operation) {
      case 'read':
        result.data = await this.readCsv(filePath);
        break;
      case 'transform':
        result.data = await this.transformCsv(filePath, transformConfig);
        break;
      case 'analyze':
        result.analysis = await this.analyzeCsv(filePath);
        break;
    }

    return result;
  }

  private async readCsv(filePath: string): Promise<any> {
    const rows: any[] = [];
    const headers: string[] = [];
    let isFirstRow = true;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true }))
        .on('error', error => reject(error))
        .on('data', row => {
          if (isFirstRow) {
            headers.push(...Object.keys(row));
            isFirstRow = false;
          }
          rows.push(row);
        })
        .on('end', () => {
          resolve({
            headers,
            rows: rows.slice(0, 1000), // Limit to first 1000 rows for performance
            totalRows: rows.length,
            sample: rows.slice(0, 5), // First 5 rows as sample
            columns: headers.length,
            fileSize: this.getFileSize(filePath)
          });
        });
    });
  }

  private async transformCsv(filePath: string, config?: any): Promise<any> {
    const data = await this.readCsv(filePath);
    let transformedRows = [...data.rows];

    if (config?.columns) {
      // Filter specific columns
      transformedRows = transformedRows.map(row => {
        const filteredRow: any = {};
        config.columns.forEach((col: string) => {
          if (row[col] !== undefined) {
            filteredRow[col] = row[col];
          }
        });
        return filteredRow;
      });
    }

    if (config?.filters) {
      // Apply filters
      transformedRows = transformedRows.filter(row => {
        return Object.entries(config.filters).every(([key, value]) => {
          return row[key] == value; // Loose equality for flexibility
        });
      });
    }

    if (config?.aggregations) {
      // Apply aggregations
      const aggregated = this.performAggregations(transformedRows, config.aggregations);
      return {
        original: data,
        transformed: transformedRows.slice(0, 100),
        transformedCount: transformedRows.length,
        aggregations: aggregated,
        transformConfig: config
      };
    }

    return {
      original: data,
      transformed: transformedRows.slice(0, 100),
      transformedCount: transformedRows.length,
      transformConfig: config
    };
  }

  private performAggregations(rows: any[], aggregations: Record<string, string>): any {
    const result: any = {};

    Object.entries(aggregations).forEach(([column, operation]) => {
      const values = rows.map(row => parseFloat(row[column])).filter(val => !isNaN(val));
      
      switch (operation.toLowerCase()) {
        case 'sum':
          result[`${column}_sum`] = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'avg':
        case 'average':
          result[`${column}_avg`] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
          break;
        case 'min':
          result[`${column}_min`] = values.length > 0 ? Math.min(...values) : null;
          break;
        case 'max':
          result[`${column}_max`] = values.length > 0 ? Math.max(...values) : null;
          break;
        case 'count':
          result[`${column}_count`] = values.length;
          break;
      }
    });

    return result;
  }

  private async analyzeCsv(filePath: string): Promise<any> {
    const data = await this.readCsv(filePath);
    const analysis: any = {
      basicStats: {
        totalRows: data.totalRows,
        totalColumns: data.columns,
        fileSize: data.fileSize
      },
      columnAnalysis: {},
      dataQuality: {
        missingValues: 0,
        duplicateRows: 0,
        dataTypes: {}
      },
      insights: []
    };

    // Analyze each column
    data.headers.forEach(header => {
      const values = data.rows.map(row => row[header]).filter(val => val !== null && val !== undefined && val !== '');
      const nonEmptyValues = values.length;
      const missingValues = data.totalRows - nonEmptyValues;

      // Detect data type
      const numericValues = values.map(val => parseFloat(val)).filter(val => !isNaN(val));
      const isNumeric = numericValues.length / values.length > 0.8;
      
      const columnStats: any = {
        totalValues: data.totalRows,
        nonEmptyValues,
        missingValues,
        missingPercentage: Math.round((missingValues / data.totalRows) * 100),
        dataType: isNumeric ? 'numeric' : 'text',
        uniqueValues: new Set(values).size
      };

      if (isNumeric && numericValues.length > 0) {
        columnStats.statistics = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length,
          median: this.calculateMedian(numericValues)
        };
      } else {
        // Text analysis
        const valueCounts = values.reduce((counts, val) => {
          counts[val] = (counts[val] || 0) + 1;
          return counts;
        }, {} as Record<string, number>);
        
        columnStats.topValues = Object.entries(valueCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([value, count]) => ({ value, count }));
      }

      analysis.columnAnalysis[header] = columnStats;
      analysis.dataQuality.missingValues += missingValues;
      analysis.dataQuality.dataTypes[header] = columnStats.dataType;
    });

    // Generate insights
    if (analysis.dataQuality.missingValues > 0) {
      analysis.insights.push(`Dataset has ${analysis.dataQuality.missingValues} missing values across all columns`);
    }

    const numericColumns = Object.entries(analysis.dataQuality.dataTypes).filter(([_, type]) => type === 'numeric').length;
    if (numericColumns > 0) {
      analysis.insights.push(`Dataset contains ${numericColumns} numeric columns suitable for statistical analysis`);
    }

    return analysis;
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  async processJson(params: any): Promise<any> {
    const { data, operation = 'parse', schema, query } = JsonProcessSchema.parse(params);
    
    let jsonData: any;
    let isFilePath = false;

    // Determine if data is a file path or JSON string
    if (typeof data === 'string' && !data.trim().startsWith('{') && !data.trim().startsWith('[')) {
      // Treat as file path
      if (!await fs.pathExists(data)) {
        throw new Error(`JSON file not found: ${data}`);
      }
      const fileContent = await fs.readFile(data, 'utf8');
      jsonData = JSON.parse(fileContent);
      isFilePath = true;
    } else {
      // Treat as JSON string or object
      jsonData = typeof data === 'string' ? JSON.parse(data) : data;
    }

    const result: any = {
      operation,
      timestamp: new Date().toISOString(),
      sourceType: isFilePath ? 'file' : 'string'
    };

    switch (operation) {
      case 'parse':
        result.parsed = jsonData;
        result.structure = this.analyzeJsonStructure(jsonData);
        break;
      case 'transform':
        result.original = jsonData;
        result.transformed = this.transformJson(jsonData);
        break;
      case 'validate':
        result.validation = this.validateJson(jsonData, schema);
        break;
      case 'query':
        result.queryResult = this.queryJson(jsonData, query);
        break;
    }

    return result;
  }

  private analyzeJsonStructure(data: any): any {
    const analysis: any = {
      type: Array.isArray(data) ? 'array' : typeof data,
      size: 0,
      depth: 0,
      keys: [],
      arrayLength: null
    };

    if (Array.isArray(data)) {
      analysis.arrayLength = data.length;
      analysis.size = JSON.stringify(data).length;
      
      if (data.length > 0 && typeof data[0] === 'object') {
        analysis.itemStructure = this.analyzeJsonStructure(data[0]);
      }
    } else if (typeof data === 'object' && data !== null) {
      analysis.keys = Object.keys(data);
      analysis.size = JSON.stringify(data).length;
      
      // Calculate depth
      const calculateDepth = (obj: any): number => {
        if (typeof obj !== 'object' || obj === null) return 0;
        return 1 + Math.max(0, ...Object.values(obj).map(calculateDepth));
      };
      analysis.depth = calculateDepth(data);
      
      // Analyze properties
      analysis.properties = {};
      Object.entries(data).forEach(([key, value]) => {
        analysis.properties[key] = {
          type: Array.isArray(value) ? 'array' : typeof value,
          hasValue: value !== null && value !== undefined
        };
      });
    }

    return analysis;
  }

  private transformJson(data: any): any {
    // Simple transformation example: flatten nested objects
    if (typeof data !== 'object' || data === null) return data;
    
    const flatten = (obj: any, prefix = ''): any => {
      const flattened: any = {};
      
      Object.entries(obj).forEach(([key, value]) => {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(flattened, flatten(value, newKey));
        } else {
          flattened[newKey] = value;
        }
      });
      
      return flattened;
    };

    if (Array.isArray(data)) {
      return data.map(item => flatten(item));
    } else {
      return flatten(data);
    }
  }

  private validateJson(data: any, schema?: any): any {
    const validation = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    // Basic validation
    if (data === null || data === undefined) {
      validation.isValid = false;
      validation.errors.push('Data is null or undefined');
    }

    // If schema is provided, do schema validation (simplified)
    if (schema) {
      validation.warnings.push('Schema validation is simplified in this implementation');
      
      if (schema.required) {
        schema.required.forEach((field: string) => {
          if (!(field in data)) {
            validation.isValid = false;
            validation.errors.push(`Required field missing: ${field}`);
          }
        });
      }
    }

    return validation;
  }

  private queryJson(data: any, query?: string): any {
    if (!query) {
      return { error: 'No query provided' };
    }

    // Simple query implementation using dot notation
    try {
      const keys = query.split('.');
      let result = data;
      
      for (const key of keys) {
        if (result && typeof result === 'object') {
          if (Array.isArray(result) && !isNaN(parseInt(key))) {
            result = result[parseInt(key)];
          } else {
            result = result[key];
          }
        } else {
          return { error: `Cannot access property '${key}' on ${typeof result}` };
        }
      }
      
      return { result, query };
    } catch (error) {
      return { error: `Query error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async convertData(params: any): Promise<any> {
    const { filePath } = CsvProcessSchema.parse(params);
    
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath, ext);
    const dirName = path.dirname(filePath);

    let result: any = {
      originalFile: filePath,
      conversions: [],
      timestamp: new Date().toISOString()
    };

    switch (ext) {
      case '.csv':
        // Convert CSV to JSON
        const csvData = await this.readCsv(filePath);
        const jsonPath = path.join(dirName, `${baseName}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(csvData.rows, null, 2));
        result.conversions.push({ format: 'json', path: jsonPath });
        break;
        
      case '.json':
        // Convert JSON to CSV (if it's an array of objects)
        const jsonContent = JSON.parse(await fs.readFile(filePath, 'utf8'));
        if (Array.isArray(jsonContent) && jsonContent.length > 0 && typeof jsonContent[0] === 'object') {
          const csvPath = path.join(dirName, `${baseName}.csv`);
          await this.writeCsv(csvPath, jsonContent);
          result.conversions.push({ format: 'csv', path: csvPath });
        } else {
          result.error = 'JSON file must contain an array of objects for CSV conversion';
        }
        break;
        
      default:
        result.error = `Conversion not supported for ${ext} files`;
    }

    return result;
  }

  private async writeCsv(filePath: string, data: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      const csvStream = csv.format({ headers: true });
      
      csvStream.pipe(writeStream);
      
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      
      data.forEach(row => csvStream.write(row));
      csvStream.end();
    });
  }

  async analyzeData(params: any): Promise<any> {
    const { filePath } = CsvProcessSchema.parse(params);
    
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.csv':
        return await this.analyzeCsv(filePath);
      case '.json':
        const jsonData = JSON.parse(await fs.readFile(filePath, 'utf8'));
        return {
          filePath,
          structure: this.analyzeJsonStructure(jsonData),
          recommendations: this.generateDataRecommendations(jsonData),
          timestamp: new Date().toISOString()
        };
      default:
        throw new Error(`Analysis not supported for ${ext} files`);
    }
  }

  private generateDataRecommendations(data: any): string[] {
    const recommendations: string[] = [];
    
    if (Array.isArray(data)) {
      if (data.length > 10000) {
        recommendations.push('Large dataset detected. Consider pagination or chunked processing.');
      }
      
      if (data.length > 0 && typeof data[0] === 'object') {
        const keys = Object.keys(data[0]);
        if (keys.length > 20) {
          recommendations.push('Many columns detected. Consider focusing on key metrics.');
        }
      }
    }
    
    const jsonSize = JSON.stringify(data).length;
    if (jsonSize > 1000000) { // > 1MB
      recommendations.push('Large JSON file. Consider streaming or breaking into smaller chunks.');
    }
    
    recommendations.push('Regularly backup important data files.');
    recommendations.push('Consider implementing data validation rules.');
    
    return recommendations;
  }

  async processPdf(params: any): Promise<any> {
    const { filePath } = CsvProcessSchema.parse(params);
    
    if (!await fs.pathExists(filePath)) {
      throw new Error(`PDF file not found: ${filePath}`);
    }

    const buffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(buffer);

    const analysis = {
      filePath,
      pages: pdfData.numpages,
      text: pdfData.text,
      textLength: pdfData.text.length,
      info: pdfData.info,
      metadata: pdfData.metadata,
      extractedData: this.extractDataFromText(pdfData.text),
      timestamp: new Date().toISOString()
    };

    return analysis;
  }

  private extractDataFromText(text: string): any {
    const extracted = {
      emails: [],
      urls: [],
      phoneNumbers: [],
      dates: [],
      numbers: []
    };

    // Extract emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    extracted.emails = text.match(emailRegex) || [];

    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    extracted.urls = text.match(urlRegex) || [];

    // Extract phone numbers (simple pattern)
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    extracted.phoneNumbers = text.match(phoneRegex) || [];

    // Extract dates (MM/DD/YYYY pattern)
    const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g;
    extracted.dates = text.match(dateRegex) || [];

    // Extract numbers
    const numberRegex = /\b\d+(?:\.\d+)?\b/g;
    const numbers = text.match(numberRegex) || [];
    extracted.numbers = numbers.map(num => parseFloat(num)).slice(0, 50); // Limit to first 50

    return extracted;
  }

  private getFileSize(filePath: string): string {
    try {
      const stats = fs.statSync(filePath);
      const bytes = stats.size;
      
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } catch {
      return 'Unknown';
    }
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