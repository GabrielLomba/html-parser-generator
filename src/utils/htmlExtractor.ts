import * as cheerio from 'cheerio';

export function generateUrlPattern(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        let pattern = pathname
            .replace(/\/\d+/g, '/{id}')
            .replace(/\/[a-f0-9-]{8,}/g, '/{uuid}')
            .replace(/\/[a-zA-Z0-9]{20,}/g, '/{hash}');
        
        return `${urlObj.hostname}${pattern}`;
    } catch (error) {
        return url;
    }
}

export function preprocessHtmlForOpenAI(htmlText: string): string {
    const $ = cheerio.load(htmlText);
    
    $('script, style, noscript, iframe, embed, object, nav, header, footer').remove();
    $('[class*="ad"], [class*="sidebar"], [class*="menu"], [class*="nav"], [class*="footer"], [class*="header"]').remove();
    $('[id*="ad"], [id*="sidebar"], [id*="menu"], [id*="nav"], [id*="footer"], [id*="header"]').remove();
    
    const structure = {
        title: $('title').text().trim(),
        headings: $('h1, h2, h3').map((i, el) => $(el).text().trim()).get().slice(0, 10),
        mainContent: extractMainContent($),
        forms: $('form').length,
        links: $('a[href]').length,
        images: $('img[src]').length
    };
    
    let mainContent = $('main, article, .content, .post, .entry, #content, #main').first();
    if (mainContent.length === 0) {
        mainContent = $('body');
    }
    
    const sampleHtml = mainContent.html()?.substring(0, 3000) || htmlText.substring(0, 3000);
    
    return `Structure: ${JSON.stringify(structure, null, 2)}\n\nSample HTML (main content area):\n${sampleHtml}`;
}

function extractMainContent($: cheerio.CheerioAPI): string {
    const selectors = [
        'main', 'article', '.content', '.post', '.entry', 
        '#content', '#main', '.main-content', '[role="main"]'
    ];
    
    for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length > 0) {
            return element.text().trim().substring(0, 500);
        }
    }
    
    return $('body').text().trim().substring(0, 500);
}
