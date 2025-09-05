import * as cheerio from 'cheerio';
import { minify } from 'html-minifier-terser';
import { getErrorInfo, logger } from './logger';
import * as SpellChecker from 'spellchecker';
import { removeWhiteSpace } from './sanitization';

const MAIN_CONTENT_SELECTORS = [
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

const MAX_SAMPLE_HTML_LENGTH = 3000;

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
            if (segment.length >= 20 || isLikelyId(segment)) {
                return '{id}';
            }
            return segment;
        });

        const pattern = patternSegments.length > 0 ? `/${patternSegments.join('/')}` : '';
        return `${urlObj.hostname}${pattern}`;
    } catch (error) {
        logger.error('Error generating URL pattern:', getErrorInfo(error));
        return url;
    }
}

function isLikelyEnglishWord(segment: string): boolean {
    const letterCount = (segment.match(/[a-zA-Z]/g) || []).length;

    if (letterCount / segment.length < 0.7) {
        return false;
    }

    return !SpellChecker.isMisspelled(segment.toLowerCase());
}

function isLikelyId(urlSegment: string): boolean {
    urlSegment = decodeURIComponent(urlSegment);

    // Check if string contains UTF-8 characters (non-ASCII)
    // If it does, assume it's an ID (likely encoded content)
    if (/[^\x20-\x7E]/.test(urlSegment)) {
        return true;
    }

    if (urlSegment.length < 8) {
        return !isLikelyEnglishWord(urlSegment);
    }

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

    const lowerSegment = urlSegment.toLowerCase();

    if (commonPathWords.includes(lowerSegment)) {
        return false;
    }

    // Check if segment can be split into parts and analyzed
    // This covers: kebab-case, PascalCase, underscore/dot separated segments
    if (
        urlSegment.includes('-') ||
        /^([A-Z][a-z]+)+[A-Z]?$/.test(urlSegment) ||
        urlSegment.includes('_') ||
        urlSegment.includes('.')
    ) {
        let words: string[] = [];

        if (urlSegment.includes('-')) {
            // Kebab-case: split on hyphens
            words = urlSegment.split('-');
        } else if (urlSegment.includes('_') || urlSegment.includes('.')) {
            // Underscore or dot separated: split on both
            words = urlSegment.split(/[_.]/);
        } else if (/^[A-Z][a-z]+$/.test(urlSegment)) {
            // PascalCase: split on capital letters
            words = urlSegment.split(/(?=[A-Z])/);

            // If we only got one word in PascalCase, let's assume it's an ID
            if (words.length === 1) {
                return true;
            }
        }

        // Check if all words are English words
        // If any word is not a valid English word, it's likely an ID
        const allWordsAreEnglish = words.every(word => isLikelyEnglishWord(word));

        // If all words are English, it's not an ID (it's a semantic path)
        // If any word is not English, it's likely an ID
        return !allWordsAreEnglish;
    }

    // Alphanumeric strings of 8+ characters that aren't kebab-case are likely IDs
    // This catches things like "abc123def" or "user12345" but excludes "user-profile"
    if (/^[a-zA-Z0-9]{8,}$/.test(urlSegment) && !/^[a-z-]+$/.test(urlSegment)) {
        return true;
    }

    // If the segment is the same as the lower segment and not a word, it's likely an ID
    if (urlSegment === lowerSegment && !isLikelyEnglishWord(urlSegment)) {
        return true;
    }

    return false;
}

interface HtmlStructure {
    title: string;
    headings: string[];
    mainContent: string;
    forms: number;
    links: number;
    images: number;
}

export function getCleanedCheerioInstance(htmlText: string): cheerio.CheerioAPI {
    const $ = cheerio.load(htmlText);
    $('script, style, noscript, iframe, embed, object, nav, header, footer').remove();
    return $;
}

export async function preprocessHtmlForOpenAI(
    htmlText: string
): Promise<{ structure: HtmlStructure; sampleHtml: string }> {
    const $: cheerio.CheerioAPI = getCleanedCheerioInstance(htmlText);

    const structure: HtmlStructure = {
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

    let mainContent = $(MAIN_CONTENT_SELECTORS.join(',')).first();
    if (mainContent.length === 0) {
        mainContent = $('body');
    }

    let sampleHtml = removeWhiteSpace(mainContent.html() || htmlText);
    try {
        sampleHtml = await minify(sampleHtml, {
            collapseWhitespace: true,
            removeComments: true,
            removeEmptyElements: true,
            removeEmptyAttributes: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            minifyCSS: true,
            minifyJS: true,
        });
    } catch (error) {
        logger.error('Error minifying HTML:', getErrorInfo(error));
    }

    if (sampleHtml.length > MAX_SAMPLE_HTML_LENGTH) {
        sampleHtml = removeUnecessaryAttributes(sampleHtml);
    }

    return { structure, sampleHtml: sampleHtml.substring(0, MAX_SAMPLE_HTML_LENGTH) };
}

function extractMainContent($: cheerio.CheerioAPI): string {
    for (const selector of MAIN_CONTENT_SELECTORS) {
        const element = $(selector).first();
        if (element.length > 0) {
            return element.text().trim().substring(0, 500);
        }
    }

    return $('body').text().trim().substring(0, 500);
}

function removeUnecessaryAttributes(html: string): string {
    const $ = cheerio.load(html);

    $('*').each((_, element) => {
        const $el = $(element);
        if (element.type !== 'tag') return;
        const attributes = element.attribs || {};
        const attributeNames = Object.keys(attributes);

        if (attributeNames.length === 0) return;

        if (attributes.id) {
            Object.keys(attributes).forEach(attr => $el.removeAttr(attr));
            $el.attr('id', attributes.id);
            return;
        }

        if (attributes['data-test-id']) {
            Object.keys(attributes).forEach(attr => $el.removeAttr(attr));
            $el.attr('data-test-id', attributes['data-test-id']);
            return;
        }

        if (attributes.class) {
            const classes = attributes.class.split(/\s+/).filter((c: string) => c.trim());
            if (classes.length > 0) {
                // Find the most unique class (longest or most specific)
                const mostUniqueClass = classes.reduce((a: string, b: string) =>
                    a.length > b.length ||
                    (a.length === b.length && a.includes('-') && !b.includes('-'))
                        ? a
                        : b
                );
                // Remove all attributes first
                Object.keys(attributes).forEach(attr => $el.removeAttr(attr));
                $el.attr('class', mostUniqueClass);
                return;
            }
        }

        const identifyingAttrs = [
            'name',
            'data-name',
            'data-id',
            'data-value',
            'data-label',
            'data-cy',
            'data-test',
            'data-qa',
            'data-automation',
            'aria-label',
            'aria-labelledby',
            'for',
            'type',
            'value',
        ];

        let bestAttr = null;
        let bestScore = 0;

        for (const attrName of identifyingAttrs) {
            if (attributes[attrName]) {
                const value = attributes[attrName];
                // Score based on length and specificity
                let score = value.length;
                if (attrName.startsWith('data-')) score += 10; // Prefer data attributes
                if (attrName.includes('test') || attrName.includes('cy') || attrName.includes('qa'))
                    score += 5; // Prefer test attributes
                if (value.includes('-') || value.includes('_')) score += 3; // Prefer kebab/snake case

                if (score > bestScore) {
                    bestScore = score;
                    bestAttr = { name: attrName, value };
                }
            }
        }

        if (bestAttr) {
            Object.keys(attributes).forEach(attr => $el.removeAttr(attr));
            $el.attr(bestAttr.name, bestAttr.value);
        }
    });

    return $.html();
}
