import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
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
    metadata?: any; // New Metadata Field
    hiddenState?: any; // New Hidden State Field
}

export async function scrapeUrl(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    console.log(`[🕵️ READER] Launching for: ${url} | Options: ${JSON.stringify(options)}`);

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
        headless: "new",
        args: args
    });

    try {
        const page: any = await browser.newPage();

        // Proxy Auth
        if (proxyUrl) {
            const { username, password } = new URL(proxyUrl);
            if (username && password) await page.authenticate({ username, password });
        }

        // 2. Evasion Tactics (Phantom Phase 1)
        await page.setUserAgent(getRandomUserAgent());

        // Randomize Viewport
        const width = 1366 + Math.floor(Math.random() * 500);
        const height = 768 + Math.floor(Math.random() * 300);
        await page.setViewport({ width, height });

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

        // 4. Navigation (Conqueror Mode)
        console.log(`[🕵️ READER] Navigating to ${url}...`);
        try {
            // We wait up to 60s for network idle on Railway (infinite power)
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        } catch (e) {
            console.warn(`[RAILWAY] Navigation timeout, proceeding with partial load.`);
        }

        // 5. Force Scroll (Trigger Hydration/Lazy Loading)
        if (!options.waitFor) {
            await page.evaluate(async () => {
                await new Promise<void>((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= scrollHeight || totalHeight > 10000) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 50);
                });
            });
            // Breathe
            await new Promise(r => setTimeout(r, 1000));
        }

        // 6. Custom Wait
        if (options.waitFor) {
            console.log(`[⏳ WAIT] Waiting for selector: ${options.waitFor}`);
            await page.waitForSelector(options.waitFor, { timeout: 10000 });
        }

        // 7. Human Presence (Mouse Curve)
        try {
            await page.mouse.move(100, 100);
            await page.mouse.move(width / 2, height / 2, { steps: 25 });
        } catch (e) { }

        // 8. Deep Extraction (Phantom Phase 2)
        const hiddenState = await page.evaluate(() => {
            const getMeta = (prop: string) => document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.getAttribute('content') || null;
            return {
                json_ld: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
                    try { return JSON.parse(s.textContent || '{}') } catch { return null }
                }).filter(Boolean),
                // @ts-ignore
                next_data: window.__NEXT_DATA__ || null,
                // @ts-ignore
                nuxt_data: window.__NUXT__ || null,
                // @ts-ignore
                apollo_state: window.__APOLLO_STATE__ || null,
                meta_tags: {
                    description: getMeta('description') || getMeta('og:description'),
                    image: getMeta('og:image') || getMeta('twitter:image'),
                    site_name: getMeta('og:site_name'),
                    type: getMeta('og:type'),
                    keywords: getMeta('keywords'),
                    date: getMeta('article:published_time') || getMeta('date')
                }
            };
        });

        // 9. Screenshot (if requested)
        let screenshotData: string | undefined;
        if (options.screenshot) {
            console.log(`[📸 SNAP] Taking screenshot...`);
            const buf = await page.screenshot({ encoding: 'base64', fullPage: true });
            screenshotData = `data:image/png;base64,${buf}`;
        }

        // 10. Link Extraction
        let extractedLinks: string[] = [];
        if (options.includeLinks) {
            extractedLinks = await page.evaluate(() => {
                // @ts-ignore
                return Array.from(document.querySelectorAll('a'))
                    .map((a: any) => a.href)
                    .filter((href: string) => href && href.startsWith('http'));
            });
        }

        // 11. Content Parsing
        const html = await page.content();
        const doc = new JSDOM(html, { url });
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        // 12. Standardize Output
        const finalTitle = article?.title || await page.title();
        const finalContent = article?.content ? turndownService.turndown(article.content) : '';
        const finalMetadata = {
            author: article?.byline,
            date: hiddenState.meta_tags.date,
            description: article?.excerpt || hiddenState.meta_tags.description,
            image: hiddenState.meta_tags.image,
            siteName: hiddenState.meta_tags.site_name,
            type: hiddenState.meta_tags.type,
            keywords: hiddenState.meta_tags.keywords ? hiddenState.meta_tags.keywords.split(',') : []
        };

        return {
            title: finalTitle,
            content: finalContent,
            textContent: article?.textContent || "",
            byline: article?.byline || null,
            siteName: article?.siteName || null,
            url: url,
            screenshot: screenshotData,
            links: extractedLinks,
            schema: hiddenState.json_ld,
            metadata: finalMetadata,
            hiddenState: hiddenState
        };

    } finally {
        await browser.close();
        console.log(`[🕵️ READER] Browser closed.`);
    }
}
