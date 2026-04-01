/**
 * Mock Quip client implementation for testing without a real Quip token
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger';

/**
 * Mock data for a document thread
 */
interface MockDocument {
  threadId: string;
  title: string;
  type: string;
  text: string;
}

/**
 * Mock data for a spreadsheet thread
 */
interface MockSpreadsheet {
  /**
   * Thread ID
   */
  threadId: string;
  
  /**
   * Thread title
   */
  title: string;
  
  /**
   * Sheets in the spreadsheet
   */
  sheets: {
    /**
     * Sheet name
     */
    name: string;
    
    /**
     * CSV content
     */
    csv: string;
  }[];
}

/**
 * Mock Quip client for testing without a real Quip API token
 */
export class MockQuipClient {
  private mockData: Map<string, MockSpreadsheet> = new Map();
  private mockDocuments: Map<string, MockDocument> = new Map();
  
  /**
   * Initialize the mock client with sample data
   */
  constructor() {
    logger.info('Initializing MockQuipClient');
    
    // Add some sample spreadsheets
    this.addMockSpreadsheet({
      threadId: 'sample1',
      title: 'Sample Spreadsheet 1',
      sheets: [
        {
          name: 'Sheet1',
          csv: 'Name,Age,Email\nJohn Doe,30,john@example.com\nJane Smith,25,jane@example.com\nBob Johnson,40,bob@example.com'
        },
        {
          name: 'Sheet2',
          csv: 'Product,Price,Quantity\nWidget A,10.99,100\nWidget B,15.99,50\nWidget C,5.99,200'
        }
      ]
    });
    
    this.addMockSpreadsheet({
      threadId: 'sample2',
      title: 'Sample Spreadsheet 2',
      sheets: [
        {
          name: 'Data',
          csv: 'Date,Revenue,Expenses,Profit\n2023-01-01,5000,3000,2000\n2023-02-01,5500,3200,2300\n2023-03-01,6000,3500,2500'
        }
      ]
    });
    
    // Add sample documents
    this.addMockDocument({
      threadId: 'doc1',
      title: 'Sample Document',
      type: 'document',
      text: 'This is a sample Quip document. It contains multiple paragraphs of text. You can use this to test reading normal Quip documents via the MCP server.'
    });

    this.addMockDocument({
      threadId: 'doc2',
      title: 'Meeting Notes',
      type: 'document',
      text: 'Meeting Notes - Q1 Planning. Attendees: Alice, Bob, Charlie. Action items: Review roadmap, update timelines, schedule follow-up.'
    });

    // Add a large mock spreadsheet
    const largeSheet = this.generateLargeSheet(100, 10);
    this.addMockSpreadsheet({
      threadId: 'large',
      title: 'Large Sample Spreadsheet',
      sheets: [
        {
          name: 'LargeSheet',
          csv: largeSheet
        }
      ]
    });
  }
  
  /**
   * Add a mock spreadsheet to the client
   * 
   * @param spreadsheet Mock spreadsheet data
   */
  addMockDocument(doc: MockDocument): void {
    this.mockDocuments.set(doc.threadId, doc);
    logger.debug(`Added mock document: ${doc.threadId}`, { title: doc.title });
  }

  addMockSpreadsheet(spreadsheet: MockSpreadsheet): void {
    this.mockData.set(spreadsheet.threadId, spreadsheet);
    logger.debug(`Added mock spreadsheet: ${spreadsheet.threadId}`, { title: spreadsheet.title });
  }
  
  /**
   * Get a thread by ID
   * 
   * @param threadId ID of the thread to retrieve
   * @returns Promise resolving to thread information
   * @throws Error if the thread is not found
   */
  async getThread(threadId: string): Promise<Record<string, any>> {
    logger.info(`Getting mock thread: ${threadId}`);
    
    const spreadsheet = this.mockData.get(threadId);
    if (!spreadsheet) {
      logger.error(`Mock thread not found: ${threadId}`);
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    // Create a mock thread response
    return {
      thread: {
        id: threadId,
        title: spreadsheet.title,
        type: 'spreadsheet'
      },
      html: this.generateMockHtml(spreadsheet)
    };
  }
  
  /**
   * Export a thread to XLSX format and save it locally
   * 
   * @param threadId ID of the thread to export
   * @param outputPath Local file path where the XLSX file should be saved
   * @returns Promise resolving to path to the saved XLSX file
   * @throws Error if the thread is not found
   */
  async exportThreadToXLSX(threadId: string, outputPath: string): Promise<string> {
    logger.info(`Exporting mock thread ${threadId} to XLSX at ${outputPath}`);
    
    const spreadsheet = this.mockData.get(threadId);
    if (!spreadsheet) {
      logger.error(`Mock thread not found: ${threadId}`);
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    // In a real implementation, we would convert the CSV to XLSX here
    // For the mock, we'll just write a placeholder file
    await fs.mkdirp(path.dirname(path.resolve(outputPath)));
    await fs.writeFile(outputPath, 'Mock XLSX content');
    
    logger.info(`Successfully exported mock XLSX to ${outputPath}`);
    return outputPath;
  }
  
  /**
   * Export a thread to CSV format using HTML parsing as fallback method
   * 
   * @param threadId ID of the thread to export
   * @param sheetName Name of the sheet to extract (optional)
   * @returns Promise resolving to CSV data as string
   * @throws Error if the thread is not found or does not contain a spreadsheet
   */
  async exportThreadToCSVFallback(threadId: string, sheetName?: string): Promise<string> {
    logger.info(`Using fallback method to export mock thread ${threadId} to CSV, sheet: ${sheetName || 'default'}`);
    
    const spreadsheet = this.mockData.get(threadId);
    if (!spreadsheet) {
      logger.error(`Mock thread not found: ${threadId}`);
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    // Find the requested sheet or use the first one
    let sheet;
    if (sheetName) {
      sheet = spreadsheet.sheets.find(s => s.name === sheetName);
      if (!sheet) {
        logger.error(`Sheet not found: ${sheetName}`);
        throw new Error(`Sheet '${sheetName}' not found in thread ${threadId}`);
      }
    } else {
      sheet = spreadsheet.sheets[0];
      if (!sheet) {
        logger.error(`No sheets found in thread: ${threadId}`);
        throw new Error(`No sheets found in thread ${threadId}`);
      }
    }
    
    return sheet.csv;
  }
  
  /**
   * Create a new mock document
   */
  async createDocument(title: string, content: string = '', format: 'html' | 'markdown' = 'markdown'): Promise<Record<string, any>> {
    logger.info(`Creating mock document: ${title}`);
    const threadId = `mock_${Date.now()}`;
    this.addMockDocument({ threadId, title, type: 'document', text: content });
    return {
      thread: { id: threadId, title, type: 'document' },
      html: `<html><body><h1>${title}</h1><p>${content}</p></body></html>`
    };
  }

  /**
   * Append content to a mock document
   */
  async appendToDocument(threadId: string, content: string, format: 'html' | 'markdown' = 'markdown'): Promise<Record<string, any>> {
    logger.info(`Appending to mock document: ${threadId}`);
    const doc = this.mockDocuments.get(threadId);
    if (!doc) throw new Error(`Thread not found: ${threadId}`);
    doc.text += `\n${content}`;
    return {
      thread: { id: threadId, title: doc.title, type: doc.type }
    };
  }

  /**
   * Read text content from a mock document thread
   *
   * @param threadId ID of the thread to read
   * @returns Promise resolving to document content
   */
  async getDocumentText(threadId: string): Promise<{ title: string; type: string; text_content: string; word_count: number }> {
    logger.info(`Getting mock document text for thread: ${threadId}`);

    const doc = this.mockDocuments.get(threadId);
    if (!doc) {
      logger.error(`Mock document not found: ${threadId}`);
      throw new Error(`Thread not found: ${threadId}`);
    }

    return {
      title: doc.title,
      type: doc.type,
      text_content: doc.text,
      word_count: doc.text.split(/\s+/).filter(Boolean).length
    };
  }

  /**
   * Check if a thread is a spreadsheet
   *
   * @param threadId ID of the thread to check
   * @returns Promise resolving to true if the thread is a spreadsheet, false otherwise
   */
  async isSpreadsheet(threadId: string): Promise<boolean> {
    logger.info(`Checking if mock thread ${threadId} is a spreadsheet`);
    return this.mockData.has(threadId);
  }
  
  /**
   * Generate mock HTML for a spreadsheet
   * 
   * @param spreadsheet Mock spreadsheet data
   * @returns HTML string
   */
  private generateMockHtml(spreadsheet: MockSpreadsheet): string {
    let html = `<html><body><h1>${spreadsheet.title}</h1>`;
    
    for (const sheet of spreadsheet.sheets) {
      html += `<h2>${sheet.name}</h2>`;
      html += '<table>';
      
      const rows = sheet.csv.split('\n');
      for (const row of rows) {
        html += '<tr>';
        const cells = row.split(',');
        for (const cell of cells) {
          html += `<td>${cell}</td>`;
        }
        html += '</tr>';
      }
      
      html += '</table>';
    }
    
    html += '</body></html>';
    return html;
  }
  
  /**
   * Generate a large CSV sheet for testing
   * 
   * @param rows Number of rows
   * @param cols Number of columns
   * @returns CSV string
   */
  private generateLargeSheet(rows: number, cols: number): string {
    let csv = '';
    
    // Generate header row
    for (let c = 0; c < cols; c++) {
      csv += `Column${c + 1}`;
      if (c < cols - 1) {
        csv += ',';
      }
    }
    csv += '\n';
    
    // Generate data rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        csv += `Value${r + 1}-${c + 1}`;
        if (c < cols - 1) {
          csv += ',';
        }
      }
      if (r < rows - 1) {
        csv += '\n';
      }
    }
    
    return csv;
  }
}
