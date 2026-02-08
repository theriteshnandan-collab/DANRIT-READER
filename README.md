# Danrit Reader

A high-performance, stealth web scraping microservice.

## Features

- **Stealth Mode**: Uses `puppeteer-extra-plugin-stealth` to bypass bot detection.
- **Resource Blocking**: Blocks images, fonts, and stylesheets for 10x faster scraping.
- **Content Extraction**: Uses `@mozilla/readability` to extract clean article content.
- **Markdown Output**: Converts HTML to Markdown using `turndown`.
- **User-Agent Rotation**: Randomizes browser signatures on each request.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```
Server runs on `http://localhost:3002`.

## Production Build

```bash
npm run build
npm start
```

## API

### `GET /`
Returns a status dashboard.

### `GET /health`
Returns `{ "status": "ok" }` for load balancer health checks.

### `POST /v1/scrape`

**Request Body:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Article Title",
    "content": "# Markdown Content...",
    "textContent": "Plain text...",
    "byline": "Author Name",
    "siteName": "Example.com",
    "url": "https://example.com/article"
  }
}
```

## Docker

```bash
docker build -t danrit-reader .
docker run -p 3002:3002 danrit-reader
```

## Deployment

Deploy to Railway or Fly.io for persistent, long-running processes.
