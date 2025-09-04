import * as cheerio from 'cheerio';
import { getErrorInfo, logger } from './logger';

const normalizeUrl = (url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return `https://${url}`;
};

export function generateUrlPattern(url: string): string {
    try {
        const urlObj = new URL(normalizeUrl(url));
        const pathname = urlObj.pathname;

        const segments = pathname.split('/').filter(segment => segment.length > 0);
        const patternSegments = segments.map(segment => {
            if (/^\d+$/.test(segment)) {
                return '{id}';
            }
            if (/^[a-f0-9-]{8,}$/.test(segment)) {
                return '{uuid}';
            }
            if (segment.length >= 20) {
                return '{slug}';
            }
            if (isLikelyId(segment)) {
                return '{id}';
            }
            return segment;
        });

        const pattern = `/${patternSegments.join('/')}`;
        return `${urlObj.hostname}${pattern}`;
    } catch (error) {
        logger.error('Error generating URL pattern:', getErrorInfo(error));
        return url;
    }
}

function isLikelyId(segment: string): boolean {
    if (segment.length < 8) return false;

    const commonPathWords = [
        'about',
        'contact',
        'services',
        'products',
        'support',
        'help',
        'login',
        'register',
        'profile',
        'account',
        'settings',
        'dashboard',
        'admin',
        'manage',
        'create',
        'edit',
        'delete',
        'update',
        'search',
        'filter',
        'category',
        'categories',
        'archive',
        'archives',
        'download',
        'downloads',
        'upload',
        'uploads',
        'media',
        'images',
        'videos',
        'files',
        'document',
        'documents',
        'report',
        'reports',
        'analytics',
        'statistics',
        'metrics',
        'dashboard',
        'overview',
        'summary',
        'details',
        'preview',
        'history',
        'timeline',
        'calendar',
        'schedule',
        'events',
        'notifications',
        'messages',
        'inbox',
        'outbox',
        'trash',
        'recycle',
        'backup',
        'restore',
        'export',
        'import',
        'sync',
        'connect',
        'disconnect',
        'configure',
        'configuration',
        'preferences',
        'options',
        'advanced',
        'security',
        'privacy',
        'terms',
        'conditions',
        'policy',
        'policies',
        'legal',
        'copyright',
        'trademark',
        'patent',
        'license',
        'licenses',
        'agreement',
        'contract',
    ];

    const lowerSegment = segment.toLowerCase();

    if (commonPathWords.includes(lowerSegment)) {
        return false;
    }

    if (/^[a-z-]+$/.test(segment) && segment.includes('-')) {
        return false;
    }

    if (/^[A-Z][a-z]+$/.test(segment)) {
        return true;
    }

    if (segment.includes('_') || segment.includes('.')) {
        return true;
    }

    if (/^[a-zA-Z0-9]{8,}$/.test(segment) && !/^[a-z-]+$/.test(segment)) {
        return true;
    }

    return false;
}

export function getCleanedCheerioInstance(htmlText: string): cheerio.CheerioAPI {
    const $ = cheerio.load(htmlText);
    $('script, style, noscript, iframe, embed, object, nav, header, footer').remove();
    return $;
}

export function preprocessHtmlForOpenAI(htmlText: string): string {
    const $ = getCleanedCheerioInstance(htmlText);

    const structure = {
        title: $('title').text().trim(),
        headings: $('h1, h2, h3')
            .map((i, el) => $(el).text().trim())
            .get()
            .slice(0, 10),
        mainContent: extractMainContent($),
        forms: $('form').length,
        links: $('a[href]').length,
        images: $('img[src]').length,
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
        'main',
        'article',
        '.content',
        '.post',
        '.entry',
        '#content',
        '#main',
        '.main-content',
        '[role="main"]',
    ];

    for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length > 0) {
            return element.text().trim().substring(0, 500);
        }
    }

    return $('body').text().trim().substring(0, 500);
}
