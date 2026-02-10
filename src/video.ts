/**
 * ============================================================
 * 🎥 STREAMJET ENGINE V2
 * ============================================================
 * Military-Grade Video Intelligence & Extraction
 * 
 * KEY CHANGE FROM V1:
 * V1 returned a URL (IP-locked → 403 for user's browser).
 * V2 streams the raw bytes through Railway's own server.
 * ============================================================
 */

// @ts-ignore
import YTDlpWrap from 'youtube-dl-exec';
import { execFile } from 'child_process';
import { Readable } from 'stream';

const yt: any = YTDlpWrap;

export interface VideoFormat {
    format_id: string;
    ext: string;
    resolution: string;
    filesize: number | null;
    vcodec: string;
    acodec: string;
    tbr: number | null; // total bitrate
    has_video: boolean;
    has_audio: boolean;
}

export interface VideoMetadata {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    duration: number;
    uploader: string;
    platform: string;
    view_count: number;
    upload_date: string;
    formats: VideoFormat[];
}

/**
 * Fetch full metadata for a video URL.
 * Works with YouTube, Instagram, Twitter, TikTok, etc.
 */
export async function getVideoInfo(url: string): Promise<VideoMetadata> {
    console.log(`[🎥 STREAMJET] Fetching metadata for: ${url}`);

    try {
        const output = await yt(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
        });

        // Map formats into a clean structure
        const formats: VideoFormat[] = (output.formats || []).map((f: any) => ({
            format_id: f.format_id,
            ext: f.ext,
            resolution: f.resolution || `${f.width || '?'}x${f.height || '?'}`,
            filesize: f.filesize || f.filesize_approx || null,
            vcodec: f.vcodec || 'none',
            acodec: f.acodec || 'none',
            tbr: f.tbr || null,
            has_video: f.vcodec !== 'none',
            has_audio: f.acodec !== 'none',
        }));

        return {
            id: output.id,
            title: output.title || 'Unknown',
            description: output.description || '',
            thumbnail: output.thumbnail || '',
            duration: output.duration || 0,
            uploader: output.uploader || output.channel || 'Unknown',
            platform: output.extractor || 'unknown',
            view_count: output.view_count || 0,
            upload_date: output.upload_date || '',
            formats,
        };
    } catch (error) {
        console.error(`[🎥 STREAMJET] Info Error:`, error);
        throw new Error(`Failed to fetch video info: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Get the direct stream URL for a video.
 * NOTE: This URL is IP-locked to the server that resolved it.
 * Use `streamVideo()` instead to proxy the bytes.
 */
export async function getVideoStreamUrl(url: string): Promise<string> {
    console.log(`[🎥 STREAMJET] Resolving stream URL for: ${url}`);

    try {
        const output = await yt(url, {
            getUrl: true,
            format: 'best[ext=mp4]/best',
            noWarnings: true,
        });

        return String(output).trim().split('\n')[0]; // First line = best URL
    } catch (error) {
        console.error(`[🎥 STREAMJET] Stream URL Error:`, error);
        throw new Error(`Failed to resolve stream: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 🔥 THE BUFFER PROXY
 * Downloads the video on Railway's server and streams the raw bytes
 * back to the caller. This bypasses IP-lock 403 errors completely.
 * 
 * Returns: { stream: Readable, contentType: string, filename: string }
 */
export async function streamVideo(url: string): Promise<{
    stream: Readable;
    contentType: string;
    filename: string;
    filesize: number | null;
}> {
    console.log(`[🎥 STREAMJET] Buffer Proxy Active for: ${url}`);

    // Step 1: Get metadata for filename
    let title = 'danrit-video';
    let filesize: number | null = null;
    try {
        const info = await yt(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
        });
        title = (info.title || 'danrit-video').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
        // Try to find best format size
        const bestFormat = (info.formats || [])
            .filter((f: any) => f.ext === 'mp4' && f.vcodec !== 'none' && f.acodec !== 'none')
            .sort((a: any, b: any) => (b.filesize || 0) - (a.filesize || 0))[0];
        filesize = bestFormat?.filesize || bestFormat?.filesize_approx || null;
    } catch (e) {
        console.warn(`[🎥 STREAMJET] Could not get metadata for filename, using default.`);
    }

    // Step 2: Get the IP-locked stream URL
    const streamUrl = await getVideoStreamUrl(url);

    // Step 3: Fetch the stream FROM THIS SERVER (Railway IP = same IP that resolved it)
    const response = await fetch(streamUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    });

    if (!response.ok) {
        throw new Error(`Upstream video fetch failed: ${response.status} ${response.statusText}`);
    }

    // Get actual filesize from response headers
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
        filesize = parseInt(contentLength, 10);
    }

    // Convert Web ReadableStream to Node.js Readable
    const webStream = response.body;
    if (!webStream) {
        throw new Error('No response body from upstream video source');
    }

    // @ts-ignore - Node 18+ supports this
    const nodeStream = Readable.fromWeb(webStream);

    return {
        stream: nodeStream,
        contentType: response.headers.get('content-type') || 'video/mp4',
        filename: `${title}.mp4`,
        filesize,
    };
}
