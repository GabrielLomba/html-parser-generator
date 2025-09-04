import * as fs from 'fs';
import { generateUrlPattern } from '../src/utils/htmlExtractor';

interface JsonlEntry {
    shortened_url: string;
    scrape: string;
}

interface DomainPatterns {
    domain: string;
    patterns: Map<string, number>;
    urls: string[];
    patternCount: number;
}

interface PatternAnalysis {
    domain: string;
    totalUrls: number;
    uniquePatterns: number;
    patterns: Array<{
        pattern: string;
        count: number;
        percentage: number;
        sampleUrls: string[];
    }>;
    quality: {
        isTooGeneric: boolean;
        isTooSpecific: boolean;
        recommendation: string;
    };
}

class UrlPatternAnalyzer {
    private domainPatterns: Map<string, DomainPatterns> = new Map();
    private readonly minPatterns = 2; // Minimum patterns per domain to avoid being too generic
    private readonly maxPatterns = 10; // Maximum patterns per domain to avoid being too specific
    private readonly minUrlsPerPattern = 1; // Minimum URLs per pattern to be considered valid

    async analyzeJsonlFile(filePath: string): Promise<PatternAnalysis[]> {
        console.log(`Starting analysis of ${filePath}`);
        
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.trim().split('\n');
        
        console.log(`Processing ${lines.length} entries`);
        
        for (const line of lines) {
            try {
                const entry: JsonlEntry = JSON.parse(line);
                const url = entry.shortened_url;
                
                if (!url) {
                    console.warn('Skipping entry with missing shortened_url');
                    continue;
                }
                
                this.processUrl(url);
            } catch (error) {
                console.error(`Error parsing line: ${error}`);
                continue;
            }
        }
        
        console.log(`Domain patterns: ${Array.from(this.domainPatterns.entries())}`);
        return this.generateAnalysis();
    }

    private processUrl(url: string): void {
        try {
            // Normalize URL by adding protocol if missing
            const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
            const pattern = generateUrlPattern(normalizedUrl);
            const domain = this.extractDomain(normalizedUrl);
            
            if (!this.domainPatterns.has(domain)) {
                this.domainPatterns.set(domain, {
                    domain,
                    patterns: new Map(),
                    urls: [],
                    patternCount: 0
                });
            }
            
            const domainData = this.domainPatterns.get(domain)!;
            domainData.urls.push(url); // Store original URL
            
            const currentCount = domainData.patterns.get(pattern) || 0;
            domainData.patterns.set(pattern, currentCount + 1);
            domainData.patternCount = domainData.patterns.size;
            
        } catch (error) {
            console.error(`Error processing URL ${url}: ${error}`);
        }
    }

    private extractDomain(url: string): string {
        try {
            // Handle URLs that might not have protocol
            const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
            const urlObj = new URL(normalizedUrl);
            return urlObj.hostname;
        } catch (error) {
            // If URL parsing fails, try to extract domain manually
            const parts = url.split('/')[0];
            return parts.includes('.') ? parts : 'unknown';
        }
    }

    private generateAnalysis(): PatternAnalysis[] {
        const analyses: PatternAnalysis[] = [];
        
        for (const [domain, domainData] of this.domainPatterns) {
            const totalUrls = domainData.urls.length;
            const uniquePatterns = domainData.patterns.size;
            
            // Filter patterns that have enough URLs
            const validPatterns = Array.from(domainData.patterns.entries())
                .filter(([_, count]) => count >= this.minUrlsPerPattern)
                .map(([pattern, count]) => ({
                    pattern,
                    count,
                    percentage: (count / totalUrls) * 100,
                    sampleUrls: this.getSampleUrlsForPattern(domainData.urls, pattern)
                }))
                .sort((a, b) => b.count - a.count);
            
            const quality = this.assessPatternQuality(validPatterns.length, totalUrls);
            
            analyses.push({
                domain,
                totalUrls,
                uniquePatterns,
                patterns: validPatterns,
                quality
            });
        }
        
        return analyses.sort((a, b) => b.totalUrls - a.totalUrls);
    }

    private getSampleUrlsForPattern(urls: string[], pattern: string): string[] {
        return urls
            .filter(url => {
                try {
                    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
                    const urlPattern = generateUrlPattern(normalizedUrl);
                    return urlPattern === pattern;
                } catch {
                    return false;
                }
            })
            .slice(0, 3); // Return up to 3 sample URLs
    }

    private assessPatternQuality(patternCount: number, totalUrls: number): {
        isTooGeneric: boolean;
        isTooSpecific: boolean;
        recommendation: string;
    } {
        const isTooGeneric = patternCount < this.minPatterns && totalUrls > 1;
        const isTooSpecific = patternCount > this.maxPatterns;
        
        let recommendation = '';
        if (isTooGeneric) {
            recommendation = `Too few patterns (${patternCount}). Consider making patterns more specific to capture different URL structures.`;
        } else if (isTooSpecific) {
            recommendation = `Too many patterns (${patternCount}). Consider making patterns more generic to group similar URLs together.`;
        } else {
            recommendation = `Good pattern balance (${patternCount} patterns for ${totalUrls} URLs).`;
        }
        
        return {
            isTooGeneric,
            isTooSpecific,
            recommendation
        };
    }

    async generateReport(analyses: PatternAnalysis[], outputPath?: string): Promise<void> {
        const report = this.formatReport(analyses);
        
        if (outputPath) {
            fs.writeFileSync(outputPath, report);
            console.log(`Report saved to ${outputPath}`);
        } else {
            console.log(report);
        }
    }

    private formatReport(analyses: PatternAnalysis[]): string {
        let report = '# URL Pattern Analysis Report\n\n';
        report += `Generated on: ${new Date().toISOString()}\n`;
        report += `Total domains analyzed: ${analyses.length}\n\n`;
        
        // Summary statistics
        const totalUrls = analyses.reduce((sum, analysis) => sum + analysis.totalUrls, 0);
        const totalPatterns = analyses.reduce((sum, analysis) => sum + analysis.uniquePatterns, 0);
        const tooGenericCount = analyses.filter(a => a.quality.isTooGeneric).length;
        const tooSpecificCount = analyses.filter(a => a.quality.isTooSpecific).length;
        const goodQualityCount = analyses.length - tooGenericCount - tooSpecificCount;
        
        report += '## Summary\n';
        report += `- Total URLs: ${totalUrls}\n`;
        report += `- Total unique patterns: ${totalPatterns}\n`;
        report += `- Domains with good pattern quality: ${goodQualityCount}\n`;
        report += `- Domains with too few patterns: ${tooGenericCount}\n`;
        report += `- Domains with too many patterns: ${tooSpecificCount}\n\n`;
        
        // Detailed analysis per domain
        report += '## Domain Analysis\n\n';
        
        for (const analysis of analyses) {
            const qualityIcon = analysis.quality.isTooGeneric ? '⚠️' : 
                              analysis.quality.isTooSpecific ? '⚠️' : '✅';
            
            report += `### ${qualityIcon} ${analysis.domain}\n`;
            report += `- Total URLs: ${analysis.totalUrls}\n`;
            report += `- Unique patterns: ${analysis.uniquePatterns}\n`;
            report += `- Quality: ${analysis.quality.recommendation}\n\n`;
            
            if (analysis.patterns.length > 0) {
                report += '#### Patterns:\n';
                for (const pattern of analysis.patterns) {
                    report += `- **${pattern.pattern}** (${pattern.count} URLs, ${pattern.percentage.toFixed(1)}%)\n`;
                    if (pattern.sampleUrls.length > 0) {
                        report += `  - Sample URLs: ${pattern.sampleUrls.join(', ')}\n`;
                    }
                }
                report += '\n';
            }
            
            // Log differences between patterns
            if (analysis.patterns.length > 1) {
                report += '#### Pattern Differences:\n';
                const patterns = analysis.patterns.map(p => p.pattern);
                for (let i = 0; i < patterns.length - 1; i++) {
                    for (let j = i + 1; j < patterns.length; j++) {
                        const diff = this.findPatternDifferences(patterns[i], patterns[j]);
                        if (diff.length > 0) {
                            report += `- ${patterns[i]} vs ${patterns[j]}: ${diff.join(', ')}\n`;
                        }
                    }
                }
                report += '\n';
            }
        }
        
        return report;
    }

    private findPatternDifferences(pattern1: string, pattern2: string): string[] {
        const differences: string[] = [];
        
        // Extract path parts
        const path1 = pattern1.split('/').slice(1);
        const path2 = pattern2.split('/').slice(1);
        
        const maxLength = Math.max(path1.length, path2.length);
        
        for (let i = 0; i < maxLength; i++) {
            const part1 = path1[i] || '';
            const part2 = path2[i] || '';
            
            if (part1 !== part2) {
                if (part1 === '' || part2 === '') {
                    differences.push(`Different path length at position ${i}`);
                } else if (part1.startsWith('{') && part2.startsWith('{')) {
                    differences.push(`Different placeholders at position ${i}: ${part1} vs ${part2}`);
                } else if (part1.startsWith('{') || part2.startsWith('{')) {
                    differences.push(`One has placeholder at position ${i}: ${part1} vs ${part2}`);
                } else {
                    differences.push(`Different literal segments at position ${i}: ${part1} vs ${part2}`);
                }
            }
        }
        
        return differences;
    }
}

async function main() {
    const jsonlFilePath = process.argv[2] || './tmp/data.jsonl';
    const outputPath = process.argv[3] || './tmp/url_pattern_analysis.md';
    
    if (!fs.existsSync(jsonlFilePath)) {
        console.error(`File not found: ${jsonlFilePath}`);
        process.exit(1);
    }
    
    const analyzer = new UrlPatternAnalyzer();
    
    try {
        const analyses = await analyzer.analyzeJsonlFile(jsonlFilePath);
        await analyzer.generateReport(analyses, outputPath);
        
        console.log('Analysis completed successfully');
        
        // Log summary to console
        console.log('\n=== ANALYSIS SUMMARY ===');
        console.log(`Domains analyzed: ${analyses.length}`);
        console.log(`Total URLs processed: ${analyses.reduce((sum, a) => sum + a.totalUrls, 0)}`);
        console.log(`Domains with good pattern quality: ${analyses.filter(a => !a.quality.isTooGeneric && !a.quality.isTooSpecific).length}`);
        console.log(`Domains with too few patterns: ${analyses.filter(a => a.quality.isTooGeneric).length}`);
        console.log(`Domains with too many patterns: ${analyses.filter(a => a.quality.isTooSpecific).length}`);
        
    } catch (error) {
        console.error(`Analysis failed: ${error}`);
        process.exit(1);
    }
}

// Run the main function
main().catch(console.error);

export { UrlPatternAnalyzer };
export type { PatternAnalysis };