// @ts-ignore
import YTDlpWrap from 'youtube-dl-exec';

// Initialize the wrapper
const yt: any = YTDlpWrap;

export interface VideoMetadata {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    duration: number;
    uploader: string;
    platform: string;
    view_count: number;
    formats: any[];
}

export async function getVideoInfo(url: string): Promise<VideoMetadata> {
    console.log(`[🎥 VIDEO] Fetching metadata for: ${url}`);

    try {
        const output = await yt(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true
        });

        return {
            id: output.id,
            title: output.title,
            description: output.description,
            thumbnail: output.thumbnail,
            duration: output.duration,
            uploader: output.uploader,
            platform: output.extractor,
            view_count: output.view_count,
            formats: output.formats
        };
    } catch (error) {
        console.error(`[🎥 VIDEO] Info Error:`, error);
        throw new Error(`Failed to fetch video info: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getVideoStreamUrl(url: string): Promise<string> {
    console.log(`[🎥 VIDEO] Resolving stream URL for: ${url}`);

    try {
        // -g: get-url
        // -f b: best quality (that has both video+audio if possible, or best single file)
        const output = await yt(url, {
            getUrl: true,
            format: 'best',
            noWarnings: true,
        });

        // output might contain multiple lines if video and audio are separate
        // For simple playback, we want the best single file with audio
        return String(output).trim();
    } catch (error) {
        console.error(`[🎥 VIDEO] Stream Error:`, error);
        throw new Error(`Failed to resolve stream: ${error instanceof Error ? error.message : String(error)}`);
    }
}
