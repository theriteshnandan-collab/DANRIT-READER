import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import { HTTPRequest, Page } from 'puppeteer';
import { getRandomUserAgent } from './utils.js';

const puppeteer: any = puppeteerExtra;

// 1. Activate Stealth Mode
// @ts-ignore
puppeteer.use(StealthPlugin());

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});

export interface ScrapeOptions {
    render?: boolean; // If true, load images/css (slower but accurate visual)
    screenshot?: boolean; // Return base64 screenshot
    waitFor?: string; // CSS selector to wait for (e.g. '.content')
    includeLinks?: boolean; // Return all hrefs found on page
}

export interface ScrapeResult {
    title: string;
    content: string; // Markdown
    textContent: string; // Plain Text
    byline: string | null;
    siteName: string | null;
    url: string;
    screenshot?: string; // Base64
    links?: string[]; // All hrefs (if requested)
    schema?: any[]; // JSON-LD Structured Data
}

export async function scrapeUrl(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    console.log(`[🕵️ READER] Launching for: ${url} | Options: ${JSON.stringify(options)}`);

    // ... (rest of configuration is same until extraction)

    // Proxy Configuration
    const proxyUrl = process.env.PROXY_URL;
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
    ];

    if (proxyUrl) {
        const proxyUrlParsed = new URL(proxyUrl);
        args.push(`--proxy-server=${proxyUrlParsed.protocol}//${proxyUrlParsed.host}`);
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: args
    });

    try {
        const page: any = await browser.newPage();

        // Proxy Auth
        if (proxyUrl) {
            const { username, password } = new URL(proxyUrl);
            if (username && password) await page.authenticate({ username, password });
        }

        // 2. Evasion Tactics
        await page.setUserAgent(getRandomUserAgent());
        await page.setViewport({ width: 1920, height: 1080 });

        // 3. Optimization: Block massive resources UNLESS render=true
        if (!options.render) {
            await page.setRequestInterception(true);
            page.on('request', (req: any) => {
                const resourceType = req.resourceType();
                if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });
        }


        // 4. Navigation
        console.log(`[🕵️ READER] Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 5. Custom Wait or Auto-Scroll
        if (options.waitFor) {
            console.log(`[⏳ WAIT] Waiting for selector: ${options.waitFor}`);
            await page.waitForSelector(options.waitFor, { timeout: 10000 });
        } else {
            // Auto-scroll logic if no specific selector
            await page.evaluate(async () => {
                await new Promise<void>((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= scrollHeight || totalHeight > 5000) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
        }

        // 6. Screenshot (if requested)
        let screenshotData: string | undefined;
        if (options.screenshot) {
            console.log(`[📸 SNAP] Taking screenshot...`);
            const buf = await page.screenshot({ encoding: 'base64', fullPage: true });
            screenshotData = `data:image/png;base64,${buf}`;
        }

        // 7. Link Extraction (BEFORE Readability destroys the DOM)
        let extractedLinks: string[] = [];
        if (options.includeLinks) {
            extractedLinks = await page.evaluate(() => {
                // @ts-ignore
                return Array.from(document.querySelectorAll('a'))
                    .map((a: any) => a.href)
                    .filter((href: string) => href && href.startsWith('http'));
            });
            console.log(`[🔗 LINKS] Found ${extractedLinks.length} raw links.`);
        }

        // 8. Content & JSON-LD Extraction
        const html = await page.content();
        console.log(`[🕵️ READER] Parsing content & structured data...`);

        // Extract JSON-LD (Schema.org)
        const schemaData = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            return scripts.map(script => {
                try {
                    return JSON.parse(script.textContent || "");
                } catch {
                    return null;
                }
            }).filter(s => s !== null);
        });

        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        // Fallback if readability fails but we have raw content
        const finalTitle = article?.title || await page.title();
        const finalContent = article?.content || html;
        const finalMarkdown = turndownService.turndown(finalContent);

        return {
            title: finalTitle,
            content: finalMarkdown,
            textContent: article?.textContent || "",
            byline: article?.byline || null,
            siteName: article?.siteName || null,
            url: url,
            screenshot: screenshotData,
            links: extractedLinks,
            schema: schemaData
        };


    } finally {
        await browser.close();
        console.log(`[🕵️ READER] Browser closed.`);
    }
}

// ============================================================
// 🕷️ PHANTOM CRAWLER - Recursive Site-Wide Extraction
// ============================================================

export interface CrawlOptions {
    maxPages?: number;      // Hard limit on pages to scrape (default: 10)
    maxDepth?: number;      // How deep to follow links (default: 2)
    render?: boolean;       // Load images/css for each page
    screenshot?: boolean;   // Take screenshot of each page
    allowSubdomains?: boolean; // Allow links to subdomains (default: false)
}

export interface CrawlResult {
    pages: ScrapeResult[];
    stats: {
        pagesScraped: number;
        linksDiscovered: number;
        duration: number; // seconds
    };
}

export async function crawlUrl(startUrl: string, options: CrawlOptions = {}): Promise<CrawlResult> {
    const maxPages = options.maxPages ?? 10;
    const maxDepth = options.maxDepth ?? 2;
    const allowSubdomains = options.allowSubdomains ?? false;

    const startTime = Date.now();
    const visited = new Set<string>();
    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
    const results: ScrapeResult[] = [];
    let linksDiscovered = 0;

    // Extract base domain for filtering
    const startDomain = new URL(startUrl).hostname;

    console.log(`[🕷️ CRAWLER] Starting crawl of ${startUrl} | Max Pages: ${maxPages} | Max Depth: ${maxDepth}`);

    while (queue.length > 0 && results.length < maxPages) {
        const current = queue.shift();
        if (!current) break;

        const { url, depth } = current;

        // Skip if already visited or too deep
        if (visited.has(url) || depth > maxDepth) continue;
        visited.add(url);

        console.log(`[🕷️ CRAWLER] [${results.length + 1}/${maxPages}] Depth ${depth}: ${url}`);

        try {
            // Scrape the page (we need the raw HTML for link discovery, scaperUrl returns it? No, it returns cleaned.)
            // We need to modify scrapeUrl to return raw HTML or move logic? 
            // Better: scrapeUrl returns 'content' (markdown). 
            // FAST FIX: We can't easily change scrapeUrl return type without breaking things.
            // BUT, scrapeUrl uses Readability which strips navs. 
            // We need a specific "crawl" mode for scrapeUrl or just do the extraction INSIDE scrapeUrl?
            // Actually, let's just make scrapeUrl return 'links' in the result!

            const result = await scrapeUrl(url, {
                render: options.render,
                screenshot: options.screenshot,
                includeLinks: true // ADD THIS OPTION
            });
            results.push(result);

            // Don't discover links if at max depth
            if (depth >= maxDepth) continue;

            // Use the links returned by the scraper (from raw DOM)
            const links = result.links || [];

            // Filter recursively here? No, let scraper return ALL links, we filter here.
            const startDomain = new URL(startUrl).hostname;
            const filteredLinks = filterLinks(links, url, startDomain, allowSubdomains);

            linksDiscovered += filteredLinks.length;

            for (const link of filteredLinks) {
                if (!visited.has(link) && results.length + queue.length < maxPages * 2) {
                    queue.push({ url: link, depth: depth + 1 });
                }
            }
        } catch (err) {
            console.error(`[🕷️ CRAWLER] Failed to scrape ${url}:`, err);
        }
    }

    const duration = (Date.now() - startTime) / 1000;

    console.log(`[🕷️ CRAWLER] Complete! Scraped ${results.length} pages in ${duration.toFixed(2)}s`);

    return {
        pages: results,
        stats: {
            pagesScraped: results.length,
            linksDiscovered,
            duration
        }
    };
}

/**
 * Filter raw links for scope
 */
function filterLinks(
    rawLinks: string[],
    currentUrl: string,
    baseDomain: string,
    allowSubdomains: boolean
): string[] {
    const uniqueLinks = new Set<string>();

    // Normalize base domain
    const normalizedBase = baseDomain.replace(/^www\./, '');

    for (const href of rawLinks) {
        try {
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
                continue;
            }

            // Resolve relative URLs
            const absoluteUrl = new URL(href, currentUrl).href;
            const urlObj = new URL(absoluteUrl);
            const currentHost = urlObj.hostname.replace(/^www\./, '');

            // Filter: same domain or subdomains
            const isSameDomain = currentHost === normalizedBase;
            const isSubdomain = urlObj.hostname.endsWith(`.${normalizedBase}`);

            if (isSameDomain || (allowSubdomains && isSubdomain)) {
                // Normalize: remove hash, trailing slash
                const normalized = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
                if (!normalized.endsWith('.png') && !normalized.endsWith('.jpg') && !normalized.endsWith('.pdf')) {
                    uniqueLinks.add(normalized);
                }
            }
        } catch {
            // Invalid URL
        }
    }
    return Array.from(uniqueLinks);
}
