import express, { Request, Response, NextFunction } from 'express';
import { scrapeUrl, crawlUrl } from './scraper.js';

const app = express();
const PORT = process.env.PORT || 3002;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

// --- Middleware ---

// 1. CORS
app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '*';
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin as string)) {
        res.setHeader('Access-Control-Allow-Origin', origin as string);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// --- Routes ---

// Health Check (for Load Balancers / Uptime Monitors)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// 1. The "Top Level" Status Page (UI)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Danrit Reader</title>
                <style>
                    :root { --bg: #050505; --fg: #e0e0e0; --dim: #444; --border: #222; }
                    * { box-sizing: border-box; }
                    body { background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; }
                    .container { width: 100%; max-width: 480px; padding: 0; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--border); }
                    .cell { padding: 1.5rem; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); display: flex; flex-direction: column; justify-content: space-between; height: 140px; }
                    .cell:nth-child(2n) { border-right: none; }
                    .cell:last-child { border-bottom: none; border-right: none; grid-column: span 2; height: auto; flex-direction: row; align-items: center; }
                    .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--dim); margin-bottom: 0.5rem; font-weight: 600; }
                    .value { font-size: 1.2rem; font-weight: 400; letter-spacing: -0.5px; }
                    .hero { grid-column: span 2; border-bottom: 1px solid var(--border); padding: 2rem; }
                    h1 { margin: 0; font-size: 2rem; font-weight: 300; letter-spacing: -1px; }
                    .status-dot { width: 8px; height: 8px; background: #fff; border-radius: 50%; margin-right: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="grid">
                        <div class="hero">
                            <div class="label">System</div>
                            <h1>Danrit Reader</h1>
                        </div>
                        <div class="cell">
                            <div class="label">Status</div>
                            <div class="value">Operational</div>
                        </div>
                        <div class="cell">
                            <div class="label">Port</div>
                            <div class="value">${PORT}</div>
                        </div>
                        <div class="cell">
                            <div class="label">Engine</div>
                            <div class="value">Stealth V3</div>
                        </div>
                        <div class="cell">
                            <div class="label">Proxy</div>
                            <div class="value">${process.env.PROXY_URL ? 'ACTIVE' : 'DIRECT'}</div>
                        </div>
                        <div class="cell">
                            <div class="label">Uptime</div>
                            <div class="value">${(process.uptime() / 60).toFixed(2)}m</div>
                        </div>
                        <div class="cell">
                            <div style="display:flex; align-items:center">
                                <span class="status-dot"></span>
                                <span style="font-size:0.8rem; color:var(--dim)">SYSTEM READY</span>
                            </div>
                            <div style="font-size:0.8rem; color:var(--dim)">V 1.1.0</div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `);
});

// 2. Single Page Scrape
app.post('/v1/scrape', async (req, res) => {
    const { url, render, screenshot, waitFor } = req.body;

    if (!url) {
        res.status(400).json({ error: "Missing 'url' in body" });
        return;
    }

    try {
        const result = await scrapeUrl(url, { render, screenshot, waitFor });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Scrape Failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown Error";
        res.status(500).json({ success: false, error: msg });
    }
});

// 3. 🕷️ PHANTOM CRAWLER - Site-Wide Extraction
app.post('/v1/crawl', async (req, res) => {
    const { url, maxPages, maxDepth, render, screenshot, allowSubdomains } = req.body;

    if (!url) {
        res.status(400).json({ error: "Missing 'url' in body" });
        return;
    }

    try {
        const result = await crawlUrl(url, {
            maxPages: maxPages ?? 10,
            maxDepth: maxDepth ?? 2,
            render: render ?? false,
            screenshot: screenshot ?? false,
            allowSubdomains: allowSubdomains ?? false
        });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Crawl Failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown Error";
        res.status(500).json({ success: false, error: msg });
    }
});

// --- Routes ---

// ... (existing routes)

// 4. 🎥 VIDEO INTELLIGENCE
import { getVideoInfo, getVideoStreamUrl } from './video.js';

app.post('/v1/video/info', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: "Missing 'url' in body" });
        return;
    }
    try {
        const info = await getVideoInfo(url);
        res.json({ success: true, data: info });
    } catch (error) {
        console.error("Video Info Failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown Error";
        res.status(500).json({ success: false, error: msg });
    }
});

app.post('/v1/video/download', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        res.status(400).json({ error: "Missing 'url' in body" });
        return;
    }
    try {
        // Resolve the direct stream URL
        // In a real production app, you might want to proxy the stream through your server
        // to avoid CORS or IP restrictions on the client side.
        // For now, we return the direct URL.
        const streamUrl = await getVideoStreamUrl(url);
        res.json({ success: true, url: streamUrl });
    } catch (error) {
        console.error("Video Download Failed:", error);
        const msg = error instanceof Error ? error.message : "Unknown Error";
        res.status(500).json({ success: false, error: msg });
    }
});


// --- Error Handler ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[ERROR]', err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║      DANRIT READER V1.2               ║
    ╠═══════════════════════════════════════╣
    ║  Port:     ${String(PORT).padEnd(27)}║
    ║  Mode:     Stealth + Crawler + Video  ║
    ║  Health:   /health                    ║
    ║  API:      POST /v1/scrape            ║
    ║  API:      POST /v1/crawl             ║
    ║  API:      POST /v1/video/*           ║
    ╚═══════════════════════════════════════╝
    `);
});
