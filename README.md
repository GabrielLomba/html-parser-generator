# HTML Parser Generator Microservice

A TypeScript microservice that generates HTML parsers using OpenAI's API. The service analyzes HTML content from URLs and creates custom parsers to extract relevant text content.

## Features

- 🤖 AI-powered parser generation using OpenAI GPT-4
- 💾 Intelligent caching based on URL patterns
- 🧹 Automatic HTML content cleaning and text extraction
- 🚀 RESTful API with multiple endpoints
- 📊 Statistics and monitoring capabilities
- 🧪 Parser testing functionality

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   NODE_ENV=development
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Start the service:**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### GET `/`
Returns service information and available endpoints.

### GET `/api/health`
Health check endpoint.

### POST `/api/getParser`
Generates or retrieves a parser for the given URL and HTML.

**Request Body:**
```json
{
    "url": "https://example.com/article/123",
    "html": "<html>...</html>"
}
```

**Response:**
```json
{
    "parser": "function parseHtml(html) { ... }",
    "cached": false,
    "urlPattern": "example.com/article/{id}"
}
```

### GET `/api/stats`
Returns statistics about stored parsers.

**Response:**
```json
{
    "totalParsers": 5,
    "parsers": [
        {
            "urlPattern": "example.com/article/{id}",
            "createdAt": "2024-01-01T00:00:00.000Z"
        }
    ]
}
```

### GET `/api/storage-stats`
Returns storage system statistics (disk usage, file count, etc.).

**Response:**
```json
{
    "totalFiles": 5,
    "totalSize": 1024000,
    "storageDir": "/path/to/tmp/parsers"
}
```

### DELETE `/api/parser/:urlPattern`
Deletes a specific parser by URL pattern.

**Response:**
```json
{
    "message": "Parser deleted successfully",
    "urlPattern": "example.com/article/{id}"
}
```

### POST `/api/testParser`
Generates a parser and tests it with provided HTML.

**Request Body:**
```json
{
    "url": "https://example.com/article/123",
    "html": "<html>...</html>",
    "testHtml": "<html>...</html>"
}
```

## Usage Examples

### Using curl:

```bash
# Get a parser
curl -X POST http://localhost:3000/api/getParser \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://news.ycombinator.com/item?id=123456",
    "html": "<html><body><h1>Article Title</h1><p>Content here...</p></body></html>"
  }'

# Check service health
curl http://localhost:3000/api/health

# Get statistics
curl http://localhost:3000/api/stats
```

### Using JavaScript/TypeScript:

```typescript
const response = await fetch('http://localhost:3000/api/getParser', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        url: 'https://example.com/article/123',
        html: '<html>...</html>'
    })
});

const result = await response.json();
console.log('Generated parser:', result.parser);
```

## How It Works

1. **URL Pattern Generation**: The service analyzes the URL structure and creates a pattern for caching (e.g., `example.com/article/{id}`).

2. **HTML Text Extraction**: Uses Cheerio to extract relevant text content, removing scripts, styles, ads, and navigation elements.

3. **Parser Generation**: If no cached parser exists, OpenAI GPT-4 generates a custom parser function based on the URL and HTML content.

4. **Persistent Storage**: Generated parsers are saved to disk as JSON files in the configured storage directory, with an index file for fast lookups.

5. **Content Focus**: The system focuses on extracting meaningful content while filtering out noise like advertisements and navigation elements.

## Storage System

The microservice uses a disk-based storage system that:

- **Saves parsers as JSON files** in the `tmp/parsers` directory (configurable)
- **Maintains an index file** for fast URL pattern lookups
- **Handles file system errors** gracefully with proper error messages
- **Supports parser deletion** and storage statistics
- **Sanitizes filenames** to ensure filesystem compatibility

### Storage Structure
```
tmp/parsers/
├── index.json                    # URL pattern to file mapping
├── example_com_article__id_.json # Parser for example.com/article/{id}
└── news_ycombinator_com_item.json # Parser for news.ycombinator.com/item
```

## Development

- **Build**: `npm run build`
- **Development with auto-reload**: `npm run dev`
- **Watch mode**: `npm run watch`

The development mode uses nodemon to automatically restart the server when you make changes to TypeScript, JavaScript, or JSON files.

## Architecture

```
src/
├── api/           # Express routes and API handlers
├── services/      # Business logic services
├── storage/       # Data storage implementations
├── utils/         # Utility functions
├── types.ts       # TypeScript type definitions
└── index.ts       # Application entry point
```

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)
- `PARSER_STORAGE_DIR`: Directory to store parser files (default: ./tmp/parsers)

## License

MIT
