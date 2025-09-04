import * as fs from 'fs';
import * as path from 'path';

interface JsonlEntry {
    shortened_url: string;
    scrape: string;
}

interface ApiResponse {
    result: any;
    parserCreatedAt: string;
    urlPattern: string;
    cached: boolean;
}

interface ApiError {
    error: string;
    statusCode?: number;
}

interface TestResult {
    url: string;
    success: boolean;
    responseTime: number;
    error?: string;
    statusCode?: number;
    urlPattern?: string;
    cached?: boolean;
}

interface TestStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    errorRate: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    totalResponseTime: number;
    errors: Array<{
        error: string;
        count: number;
        statusCode?: number;
    }>;
    urlPatterns: Map<string, number>;
    cacheHitRate: number;
    cacheHits: number;
    cacheMisses: number;
}

class ParseApiTester {
    private baseUrl: string;
    private results: TestResult[] = [];
    private stats: TestStats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        totalResponseTime: 0,
        errors: [],
        urlPatterns: new Map(),
        cacheHitRate: 0,
        cacheHits: 0,
        cacheMisses: 0,
    };

    constructor(baseUrl: string = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
    }

    async testParseApi(filePath: string, maxRequests?: number): Promise<void> {
        console.log(`Starting API testing with ${this.baseUrl}`);
        
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.trim().split('\n');
        
        const entriesToTest = maxRequests ? lines.slice(0, maxRequests) : lines;
        console.log(`Processing ${entriesToTest.length} entries in parallel (max 100 concurrent)`);
        
        // Parse all entries first
        const parsedEntries: Array<{ entry: JsonlEntry; index: number }> = [];
        for (let i = 0; i < entriesToTest.length; i++) {
            const line = entriesToTest[i];
            try {
                const entry: JsonlEntry = JSON.parse(line);
                const url = entry.shortened_url;
                
                if (!url || !entry.scrape) {
                    console.warn(`Skipping entry ${i + 1}: missing required fields`);
                    continue;
                }
                
                parsedEntries.push({ entry, index: i + 1 });
            } catch (error) {
                console.error(`Error parsing line ${i + 1}: ${error}`);
                this.recordError(`JSON Parse Error: ${error}`, 0);
            }
        }
        
        // Process entries in parallel batches of 100
        const batchSize = 100;
        for (let i = 0; i < parsedEntries.length; i += batchSize) {
            const batch = parsedEntries.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(parsedEntries.length / batchSize)} (${batch.length} requests)`);
            
            // Run all requests in this batch in parallel
            const promises = batch.map(({ entry, index }) => 
                this.testSingleRequest(entry, index)
            );
            
            await Promise.all(promises);
            
            // Small delay between batches
            if (i + batchSize < parsedEntries.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        this.calculateStats();
        this.generateReport();
    }

    private async testSingleRequest(entry: JsonlEntry, requestNumber: number): Promise<void> {
        const startTime = Date.now();
        
        try {
            const response = await fetch(`${this.baseUrl}/api/parse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shortened_url: entry.shortened_url,
                    scrape: entry.scrape,
                }),
            });

            const responseTime = Date.now() - startTime;
            
            if (!response.ok) {
                const errorData: ApiError = await response.json().catch(() => ({ error: 'Unknown error' }));
                this.recordResult({
                    url: entry.shortened_url,
                    success: false,
                    responseTime,
                    error: errorData.error,
                    statusCode: response.status,
                });
                console.log(`❌ Request ${requestNumber}: ${response.status} - ${errorData.error}`);
            } else {
                const data: ApiResponse = await response.json();
                console.log(`🔍 Request ${entry.shortened_url}: ${JSON.stringify(data.result, null, 2)}`);
                this.recordResult({
                    url: entry.shortened_url,
                    success: true,
                    responseTime,
                    urlPattern: data.urlPattern,
                    cached: data.cached,
                });
                console.log(`✅ Request ${requestNumber}: ${response.status} - Pattern: ${data.urlPattern} (${data.cached ? 'cached' : 'new'})`);
            }
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.recordResult({
                url: entry.shortened_url,
                success: false,
                responseTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            console.log(`❌ Request ${requestNumber}: Network error - ${error}`);
        }
    }

    private recordResult(result: TestResult): void {
        this.results.push(result);
        this.stats.totalRequests++;
        
        if (result.success) {
            this.stats.successfulRequests++;
            if (result.urlPattern) {
                const count = this.stats.urlPatterns.get(result.urlPattern) || 0;
                this.stats.urlPatterns.set(result.urlPattern, count + 1);
            }
            if (result.cached) {
                this.stats.cacheHits++;
            } else {
                this.stats.cacheMisses++;
            }
        } else {
            this.stats.failedRequests++;
            this.recordError(result.error || 'Unknown error', result.statusCode);
        }
        
        this.stats.totalResponseTime += result.responseTime;
        this.stats.minResponseTime = Math.min(this.stats.minResponseTime, result.responseTime);
        this.stats.maxResponseTime = Math.max(this.stats.maxResponseTime, result.responseTime);
    }

    private recordError(error: string, statusCode?: number): void {
        const existingError = this.stats.errors.find(e => e.error === error && e.statusCode === statusCode);
        if (existingError) {
            existingError.count++;
        } else {
            this.stats.errors.push({ error, count: 1, statusCode });
        }
    }

    private calculateStats(): void {
        this.stats.errorRate = (this.stats.failedRequests / this.stats.totalRequests) * 100;
        this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.totalRequests;
        this.stats.cacheHitRate = this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100;
        
        // Sort errors by count
        this.stats.errors.sort((a, b) => b.count - a.count);
    }

    private generateReport(): void {
        const report = this.formatReport();
        
        const outputPath = '/Users/glomba/Projects/html-parser-generator/tmp/parse_api_test_report.md';
        fs.writeFileSync(outputPath, report);
        console.log(`\nReport saved to ${outputPath}`);
        
        // Console summary
        console.log('\n=== API TEST SUMMARY ===');
        console.log(`Total requests: ${this.stats.totalRequests}`);
        console.log(`Successful requests: ${this.stats.successfulRequests}`);
        console.log(`Failed requests: ${this.stats.failedRequests}`);
        console.log(`Error rate: ${this.stats.errorRate.toFixed(2)}%`);
        console.log(`Average response time: ${this.stats.averageResponseTime.toFixed(2)}ms`);
        console.log(`Min response time: ${this.stats.minResponseTime}ms`);
        console.log(`Max response time: ${this.stats.maxResponseTime}ms`);
        console.log(`Cache hit rate: ${this.stats.cacheHitRate.toFixed(2)}%`);
        console.log(`Unique URL patterns: ${this.stats.urlPatterns.size}`);
    }

    private formatReport(): string {
        let report = '# Parse API Test Report\n\n';
        report += `Generated on: ${new Date().toISOString()}\n`;
        report += `Base URL: ${this.baseUrl}\n\n`;
        
        // Summary statistics
        report += '## Summary Statistics\n\n';
        report += `- **Total Requests**: ${this.stats.totalRequests}\n`;
        report += `- **Successful Requests**: ${this.stats.successfulRequests}\n`;
        report += `- **Failed Requests**: ${this.stats.failedRequests}\n`;
        report += `- **Error Rate**: ${this.stats.errorRate.toFixed(2)}%\n`;
        report += `- **Average Response Time**: ${this.stats.averageResponseTime.toFixed(2)}ms\n`;
        report += `- **Min Response Time**: ${this.stats.minResponseTime}ms\n`;
        report += `- **Max Response Time**: ${this.stats.maxResponseTime}ms\n`;
        report += `- **Cache Hit Rate**: ${this.stats.cacheHitRate.toFixed(2)}%\n`;
        report += `- **Cache Hits**: ${this.stats.cacheHits}\n`;
        report += `- **Cache Misses**: ${this.stats.cacheMisses}\n`;
        report += `- **Unique URL Patterns**: ${this.stats.urlPatterns.size}\n\n`;
        
        // Error breakdown
        if (this.stats.errors.length > 0) {
            report += '## Error Breakdown\n\n';
            for (const error of this.stats.errors) {
                report += `- **${error.error}** (${error.count} occurrences`;
                if (error.statusCode) {
                    report += `, Status: ${error.statusCode}`;
                }
                report += ')\n';
            }
            report += '\n';
        }
        
        // Top URL patterns
        const sortedPatterns = Array.from(this.stats.urlPatterns.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
        
        if (sortedPatterns.length > 0) {
            report += '## Top URL Patterns\n\n';
            for (const [pattern, count] of sortedPatterns) {
                report += `- **${pattern}** (${count} requests)\n`;
            }
            report += '\n';
        }
        
        // Performance analysis
        report += '## Performance Analysis\n\n';
        
        const responseTimeRanges = [
            { min: 0, max: 100, label: 'Very Fast (0-100ms)' },
            { min: 100, max: 500, label: 'Fast (100-500ms)' },
            { min: 500, max: 1000, label: 'Moderate (500ms-1s)' },
            { min: 1000, max: 2000, label: 'Slow (1-2s)' },
            { min: 2000, max: Infinity, label: 'Very Slow (2s+)' },
        ];
        
        for (const range of responseTimeRanges) {
            const count = this.results.filter(r => 
                r.responseTime >= range.min && r.responseTime < range.max
            ).length;
            const percentage = (count / this.stats.totalRequests) * 100;
            report += `- **${range.label}**: ${count} requests (${percentage.toFixed(1)}%)\n`;
        }
        
        report += '\n';
        
        // Sample failed requests
        const failedRequests = this.results.filter(r => !r.success).slice(0, 10);
        if (failedRequests.length > 0) {
            report += '## Sample Failed Requests\n\n';
            for (const request of failedRequests) {
                report += `- **URL**: ${request.url}\n`;
                report += `  - Error: ${request.error}\n`;
                report += `  - Response Time: ${request.responseTime}ms\n`;
                if (request.statusCode) {
                    report += `  - Status Code: ${request.statusCode}\n`;
                }
                report += '\n';
            }
        }
        
        return report;
    }
}

async function main() {
    const jsonlFilePath = process.argv[2] || '/Users/glomba/Projects/html-parser-generator/tmp/data2.jsonl';
    const baseUrl = process.argv[3] || 'http://localhost:3000';
    const maxRequests = process.argv[4] ? parseInt(process.argv[4]) : undefined;
    
    if (!fs.existsSync(jsonlFilePath)) {
        console.error(`File not found: ${jsonlFilePath}`);
        process.exit(1);
    }
    
    const tester = new ParseApiTester(baseUrl);
    
    try {
        await tester.testParseApi(jsonlFilePath, maxRequests);
        console.log('\nAPI testing completed successfully');
    } catch (error) {
        console.error(`API testing failed: ${error}`);
        process.exit(1);
    }
}

// Run the main function
main().catch(console.error);

export { ParseApiTester };
