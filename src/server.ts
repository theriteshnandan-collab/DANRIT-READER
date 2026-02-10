/**
 * ============================================================
 * 🏗️ DANRIT ENGINE V2.0
 * ============================================================
 * Unified Microservice for:
 *   - Web Scraping (Conqueror Mode)
 *   - Site Crawling (Spider Mode)
 *   - Video Intelligence (StreamJet)
 * ============================================================
 */

import express, { Request, Response, NextFunction } from 'express';
import { scrapeUrl, crawlUrl } from './scraper.js';
import { getVideoInfo, getVideoStreamUrl, streamVideo } from './video.js';

const app = express();
const PORT = process.env.PORT || 3002;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

// ============================================================
// MIDDLEWARE
// ============================================================

// 1. CORS
app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '*';
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin as string)) {
        res.setHeader('Access-Control-Allow-Origin', origin as string);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }
    next();
});

// 2. JSON Body Parser
app.use(express.json());

// 3. Request Logger
app.use((req: Request, res: Response, next: NextFunction) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${req.method} ${req.path}`);
    next();
});

// ============================================================
// ROUTES: HEALTH & STATUS
// ============================================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), version: '2.0.0' });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Danrit Engine V2</title>
                <style>
                    :root { --bg: #050505; --fg: #e0e0e0; --dim: #555; --border: #1a1a1a; --accent: #00ff88; }
                    * { box-sizing: border-box; margin: 0; }
                    body { background: var(--bg); color: var(--fg); font-family: 'SF Mono', 'Fira Code', monospace; height: 100vh; display: flex; align-items: center; justify-content: center; }
                    .card { border: 1px solid var(--border); padding: 3rem; max-width: 500px; width: 100%; }
                    h1 { font-size: 1.8rem; font-weight: 300; letter-spacing: -1px; margin-bottom: 2rem; }
                    .row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
                    .row:last-child { border-bottom: none; }
                    .label { color: var(--dim); text-transform: uppercase; letter-spacing: 1px; font-size: 0.7rem; }
                    .value { color: var(--accent); }
                    .dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%; display: inline-block; margin-right: 8px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>DANRIT ENGINE <span style="color:var(--accent)">V2</span></h1>
                    <div class="row"><span class="label">Status</span><span class="value"><span class="dot"></span>ONLINE</span></div>
                    <div class="row"><span class="label">Port</span><span class="value">${PORT}</span></div>
                    <div class="row"><span class="label">Scraper</span><span class="value">Conqueror V2</span></div>
                    <div class="row"><span class="label">Crawler</span><span class="value">Spider V1</span></div>
                    <div class="row"><span class="label">Video</span><span class="value">StreamJet V2</span></div>
                    <div class="row"><span class="label">Proxy</span><span class="value">${process.env.PROXY_URL ? 'ACTIVE' : 'DIRECT'}</span></div>
                    <div class="row"><span class="label">Uptime</span><span class="value">${(process.uptime() / 60).toFixed(1)}m</span></div>
                </div>
            </body>
        </html>
    `);
});

// ============================================================
// ROUTES: SCRAPER (Conqueror Mode)
// ============================================================

app.post('/v1/scrape', async (req, res) => {
    const { url, render, screenshot, waitFor } = req.body;

    if (!url) {
        res.status(400).json({ error: "Missing 'url' in body" });
        return;
    }

    const startTime = Date.now();
    try {
        console.log(`[🕵️ ENGINE] Scrape request: ${url}`);
        const result = await scrapeUrl(url, { render, screenshot, waitFor, includeLinks: true });
        const duration = Date.now() - startTime;

        res.json({
            success: true,
            data: result,
            meta: { duration_ms: duration, engine: 'conqueror-v2' }
        });
    } catch (error) {
        console.error("Scrape Failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown Error";
        res.status(500).json({ success: false, error: msg });
    }
});

// ============================================================
// ROUTES: CRAWLER (Spider Mode)
// ============================================================

app.post('/v1/crawl', async (req, res) => {
    const { url, maxPages, maxDepth, render, screenshot, allowSubdomains } = req.body;

    if (!url) {
        res.status(400).json({ error: "Missing 'url' in body" });
        return;
    }

    const startTime = Date.now();
    try {
        console.log(`[🕷️ ENGINE] Crawl request: ${url} | Max: ${maxPages ?? 10} pages`);
        const result = await crawlUrl(url, {
            maxPages: maxPages ?? 10,
            maxDepth: maxDepth ?? 2,
            render: render ?? false,
            screenshot: screenshot ?? false,
            allowSubdomains: allowSubdomains ?? false
        });
        const duration = Date.now() - startTime;

        res.json({
            success: true,
            data: result,
            meta: { duration_ms: duration, engine: 'spider-v1' }
        });
    } catch (error) {
        console.error("Crawl Failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown Error";
        res.status(500).json({ success: false, error: msg });
    }
});

// ============================================================
// ROUTES: VIDEO INTELLIGENCE (StreamJet)
// ============================================================

// Get metadata only
app.post('/v1/video/info', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: "Missing 'url' in body" });
        return;
    }
    try {
        console.log(`[🎥 ENGINE] Video Info: ${url}`);
        const info = await getVideoInfo(url);
        res.json({ success: true, data: info });
    } catch (error) {
        console.error("Video Info Failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown Error";
        res.status(500).json({ success: false, error: msg });
    }
});

// Get stream URL (legacy)
app.post('/v1/video/download', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: "Missing 'url' in body" });
        return;
    }
    try {
        console.log(`[🎥 ENGINE] Video Download URL: ${url}`);
        const streamUrl = await getVideoStreamUrl(url);
        res.json({ success: true, url: streamUrl });
    } catch (error) {
        console.error("Video Download Failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown Error";
        res.status(500).json({ success: false, error: msg });
    }
});

/**
 * 🔥 THE KEY NEW ENDPOINT: Buffer Proxy Stream
 * This solves the 403 problem forever.
 * Railway downloads the video bytes and pipes them to the client.
 */
app.post('/v1/video/stream', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: "Missing 'url' in body" });
        return;
    }

    try {
        console.log(`[🎥 STREAMJET] Buffer Proxy for: ${url}`);
        const { stream, contentType, filename, filesize } = await streamVideo(url);

        // Set headers for download
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        if (filesize) {
            res.setHeader('Content-Length', String(filesize));
        }

        // Pipe the stream directly to the HTTP response
        stream.pipe(res);

        stream.on('error', (err) => {
            console.error('[🎥 STREAMJET] Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream failed' });
            }
        });
    } catch (error) {
        console.error("Video Stream Failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown Error";
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: msg });
        }
    }
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[ERROR]', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// ============================================================
// START
// ============================================================

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║       DANRIT ENGINE V2.0                  ║
    ╠═══════════════════════════════════════════╣
    ║  Port:     ${String(PORT).padEnd(31)}║
    ║  Scraper:  Conqueror V2 (Stealth)        ║
    ║  Crawler:  Spider V1 (Recursive)         ║
    ║  Video:    StreamJet V2 (Buffer Proxy)   ║
    ╠═══════════════════════════════════════════╣
    ║  POST /v1/scrape      → Single Page      ║
    ║  POST /v1/crawl       → Full Site        ║
    ║  POST /v1/video/info  → Metadata         ║
    ║  POST /v1/video/stream → 🔥 DOWNLOAD     ║
    ╚═══════════════════════════════════════════╝
    `);
});
