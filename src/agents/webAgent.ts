import axios from 'axios';
import * as cheerio from 'cheerio';
import { Agent, Tool, AgentResponse, WebScrapeSchema, WebSearchSchema } from '../types';

export class WebResearchAgent implements Agent {
  name = 'Web Research Agent';
  description = 'Handles web scraping, API calls, and online research tasks';
  
  private rateLimiter = new Map<string, number>();
  
  tools: Tool[] = [
    {
      name: 'scrape_webpage',
      description: 'Scrape content from a webpage',
      schema: WebScrapeSchema,
      execute: this.scrapeWebpage.bind(this)
    },
    {
      name: 'search_web',
      description: 'Search the web for information',
      schema: WebSearchSchema,
      execute: this.searchWeb.bind(this)
    },
    {
      name: 'fetch_api',
      description: 'Make API calls to REST endpoints',
      schema: WebScrapeSchema,
      execute: this.fetchApi.bind(this)
    },
    {
      name: 'extract_links',
      description: 'Extract all links from a webpage',
      schema: WebScrapeSchema,
      execute: this.extractLinks.bind(this)
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

      // Rate limiting check
      if (!this.checkRateLimit(parsed.params.url || 'general')) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please wait before making more requests.',
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
          url: parsed.params.url 
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
    
    if (lowerInput.includes('search') && !lowerInput.includes('http')) {
      return {
        tool: 'search_web',
        params: { 
          query: input.replace(/search\s+/i, '').trim(),
          maxResults: 10 
        }
      };
    }
    
    if (lowerInput.includes('links') || lowerInput.includes('extract links')) {
      const urlMatch = input.match(/https?:\/\/[^\s]+/);
      return {
        tool: 'extract_links',
        params: { 
          url: urlMatch?.[0] || input.trim(),
          extractType: 'links' as const
        }
      };
    }
    
    if (lowerInput.includes('api') || lowerInput.includes('fetch')) {
      const urlMatch = input.match(/https?:\/\/[^\s]+/);
      return {
        tool: 'fetch_api',
        params: { url: urlMatch?.[0] || input.trim() }
      };
    }
    
    // Default to scraping
    const urlMatch = input.match(/https?:\/\/[^\s]+/);
    return {
      tool: 'scrape_webpage',
      params: { 
        url: urlMatch?.[0] || input.trim(),
        extractType: 'text' as const
      }
    };
  }

  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    const lastRequest = this.rateLimiter.get(key) || 0;
    
    // Allow one request per second per domain
    if (now - lastRequest < 1000) {
      return false;
    }
    
    this.rateLimiter.set(key, now);
    return true;
  }

  async scrapeWebpage(params: any): Promise<any> {
    const { url, selector, extractType = 'text' } = WebScrapeSchema.parse(params);
    
    // Validate URL
    if (!url.startsWith('http')) {
      throw new Error('URL must start with http:// or https://');
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MM-Agent/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const $ = cheerio.load(response.data);
    
    let content: any;
    const targetElement = selector ? $(selector) : $('body');

    switch (extractType) {
      case 'text':
        content = targetElement.text().trim();
        break;
      case 'html':
        content = targetElement.html();
        break;
      case 'links':
        content = this.extractLinksFromElement($, targetElement);
        break;
      case 'images':
        content = this.extractImagesFromElement($, targetElement, url);
        break;
      default:
        content = targetElement.text().trim();
    }

    // Extract metadata
    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const keywords = $('meta[name="keywords"]').attr('content') || '';

    return {
      url,
      title,
      description,
      keywords,
      content,
      contentType: extractType,
      selector: selector || 'body',
      timestamp: new Date().toISOString(),
      contentLength: typeof content === 'string' ? content.length : JSON.stringify(content).length,
      statusCode: response.status
    };
  }

  async searchWeb(params: any): Promise<any> {
    const { query, maxResults = 10 } = WebSearchSchema.parse(params);
    
    // Using DuckDuckGo Instant Answer API (limited but free)
    try {
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await axios.get(searchUrl, { timeout: 5000 });
      
      const data = response.data;
      const results: any[] = [];
      
      // Extract instant answer
      if (data.Abstract) {
        results.push({
          title: data.Heading || 'Instant Answer',
          snippet: data.Abstract,
          url: data.AbstractURL,
          source: 'DuckDuckGo Instant',
          type: 'instant_answer'
        });
      }
      
      // Extract related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0],
              snippet: topic.Text,
              url: topic.FirstURL,
              source: 'DuckDuckGo Related',
              type: 'related_topic'
            });
          }
        }
      }

      return {
        query,
        resultsCount: results.length,
        results,
        source: 'DuckDuckGo API',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Fallback: return search suggestions
      return {
        query,
        resultsCount: 0,
        results: [],
        error: 'Search API unavailable',
        suggestions: [
          `Try searching manually: https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          `Alternative search: https://www.google.com/search?q=${encodeURIComponent(query)}`
        ],
        timestamp: new Date().toISOString()
      };
    }
  }

  async fetchApi(params: any): Promise<any> {
    const { url } = WebScrapeSchema.parse(params);
    
    if (!url.startsWith('http')) {
      throw new Error('URL must start with http:// or https://');
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'MM-Agent/1.0',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    let data = response.data;
    
    // Try to parse as JSON if it's a string
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    return {
      url,
      data,
      statusCode: response.status,
      headers: response.headers,
      contentType: response.headers['content-type'],
      size: JSON.stringify(data).length,
      timestamp: new Date().toISOString()
    };
  }

  async extractLinks(params: any): Promise<any> {
    const { url } = WebScrapeSchema.parse(params);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MM-Agent/1.0)'
      }
    });

    const $ = cheerio.load(response.data);
    const links = this.extractLinksFromElement($, $('body'));

    return {
      url,
      linksCount: links.length,
      links,
      timestamp: new Date().toISOString()
    };
  }

  private extractLinksFromElement($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>): any[] {
    const links: any[] = [];
    
    element.find('a[href]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      if (href) {
        links.push({
          url: href,
          text: text || href,
          isExternal: href.startsWith('http'),
          isEmail: href.startsWith('mailto:'),
          isTel: href.startsWith('tel:')
        });
      }
    });
    
    return links;
  }

  private extractImagesFromElement($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>, baseUrl: string): any[] {
    const images: any[] = [];
    
    element.find('img').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      const alt = $el.attr('alt');
      const title = $el.attr('title');
      
      if (src) {
        let fullUrl = src;
        if (!src.startsWith('http')) {
          const base = new URL(baseUrl);
          fullUrl = new URL(src, base.origin).toString();
        }
        
        images.push({
          src: fullUrl,
          alt: alt || '',
          title: title || '',
          width: $el.attr('width'),
          height: $el.attr('height')
        });
      }
    });
    
    return images;
  }
}