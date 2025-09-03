import * as cheerio from 'cheerio';

/**
 * Extracts relevant text content from HTML, stripping out scripts, styles, and other non-content elements
 */
export function extractRelevantText(html: string): string {
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script, style, noscript, iframe, embed, object').remove();
    
    // Remove elements with common non-content classes/ids
    $('[class*="ad"], [class*="advertisement"], [class*="sidebar"], [class*="menu"], [class*="nav"], [class*="footer"], [class*="header"]').remove();
    $('[id*="ad"], [id*="advertisement"], [id*="sidebar"], [id*="menu"], [id*="nav"], [id*="footer"], [id*="header"]').remove();
    
    // Get text content and clean it up
    let text = $.text();
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Remove common non-content patterns
    text = text.replace(/\b(cookie|privacy|terms|subscribe|newsletter|follow us|share|like|comment)\b/gi, '');
    
    return text;
}

/**
 * Generates a URL pattern for caching based on the URL structure
 */
export function generateUrlPattern(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        // Replace dynamic segments with wildcards
        let pattern = pathname
            .replace(/\/\d+/g, '/{id}')  // Replace numeric IDs
            .replace(/\/[a-f0-9-]{8,}/g, '/{uuid}')  // Replace UUIDs
            .replace(/\/[a-zA-Z0-9]{20,}/g, '/{hash}');  // Replace long hashes
        
        return `${urlObj.hostname}${pattern}`;
    } catch (error) {
        // If URL parsing fails, use the original URL
        return url;
    }
}
