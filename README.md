# HTML Parser Generator Microservice

A TypeScript microservice that generates HTML parsers using OpenAI's API. The service analyzes HTML content from URLs and creates custom parsers to extract relevant text content.

## Features

- 🤖 AI-powered parser generation using OpenAI GPT-4
- 💾 Intelligent caching based on URL patterns
- 🧹 Automatic HTML content cleaning and text extraction
- 🚀 RESTful API with multiple endpoints
- 📊 Statistics and monitoring capabilities with cost tracking
- 🔄 Concurrent request deduplication for efficiency
- 💰 Token usage tracking and cost estimation
- 📝 Enhanced logging with structured output
- 🧪 Parser testing and validation
- 🗂️ Disk-based persistent storage with indexing

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

### GET `/api/health`
Health check endpoint.

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST `/api/parse`
Parses HTML content using AI-generated parsers and returns extracted content.

**Request Body:**
```json
{
    "shortened_url": "https://example.com/article/123",
    "scrape": "<html>...</html>"
}
```

**Query Parameters:**
- `no_cache` (optional): Set to `true` to bypass cache and generate a new parser

**Response:**
```json
{
    "result": {
        "title": "Article Title",
        "content": "Extracted content...",
        "author": "Author Name"
    },
    "parserCreatedAt": "2024-01-01T00:00:00.000Z",
    "urlPattern": "example.com/article/{id}",
    "cached": false
}
```

### GET `/api/stats`
Returns statistics about stored parsers and AI usage.

**Response:**
```json
{
    "totalParsers": 5,
    "parsers": [
        {
            "urlPattern": "example.com/article/{id}",
            "createdAt": "2024-01-01T00:00:00.000Z"
        }
    ],
    "generatorStats": {
        "totalRequests": 10,
        "averageInputTokens": 1500,
        "averageOutputTokens": 800,
        "costEstimate": {
            "inputCost": 0.045,
            "outputCost": 0.048,
            "totalCost": 0.093
        }
    }
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

## Usage Examples

### Using curl:

```bash
# Parse HTML content
curl -X POST http://localhost:3000/api/parse \
  -H "Content-Type: application/json" \
  -d '{
    "shortened_url": "https://news.ycombinator.com/item?id=123456",
    "scrape": "<html><body><h1>Article Title</h1><p>Content here...</p></body></html>"
  }'

# Parse with no cache (force new parser generation)
curl -X POST "http://localhost:3000/api/parse?no_cache=true" \
  -H "Content-Type: application/json" \
  -d '{
    "shortened_url": "https://example.com/article/123",
    "scrape": "<html>...</html>"
  }'

# Check service health
curl http://localhost:3000/api/health

# Get statistics
curl http://localhost:3000/api/stats

# Delete a parser
curl -X DELETE "http://localhost:3000/api/parser/example.com%2Farticle%2F%7Bid%7D"
```

### Using JavaScript/TypeScript:

```typescript
// Parse HTML content
const response = await fetch('http://localhost:3000/api/parse', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        shortened_url: 'https://example.com/article/123',
        scrape: '<html>...</html>'
    })
});

const result = await response.json();
console.log('Extracted content:', result.result);
console.log('Parser cached:', result.cached);

// Parse with no cache
const responseNoCache = await fetch('http://localhost:3000/api/parse?no_cache=true', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        shortened_url: 'https://example.com/article/123',
        scrape: '<html>...</html>'
    })
});

// Get statistics
const statsResponse = await fetch('http://localhost:3000/api/stats');
const stats = await statsResponse.json();
console.log('Total parsers:', stats.totalParsers);
console.log('AI usage cost:', stats.generatorStats.costEstimate.totalCost);
```

## How It Works

1. **URL Pattern Generation**: The service analyzes the URL structure and creates a pattern for caching (e.g., `example.com/article/{id}`).

2. **HTML Preprocessing**: Uses Cheerio to clean and extract relevant content, removing scripts, styles, ads, and navigation elements. The HTML is minified and structured for optimal AI processing.

3. **AI Parser Generation**: If no cached parser exists, OpenAI GPT-4 generates a custom parser function based on the URL and HTML content. The system uses intelligent prompting to create robust, error-handling parsers.

4. **Content Extraction**: The generated parser is executed immediately to extract structured content from the provided HTML, returning clean, sanitized results.

5. **Persistent Storage**: Generated parsers are saved to disk as JSON files in the configured storage directory, with an index file for fast lookups.

6. **Token Tracking**: The system tracks OpenAI API usage, providing cost estimates and performance metrics for monitoring and optimization.

7. **Concurrent Request Handling**: Multiple requests for the same URL pattern are deduplicated to prevent redundant AI calls and improve efficiency.

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
- **Watch mode**: `npm run build:watch`
- **Testing**: `npm test` or `npm run test:watch`
- **Test coverage**: `npm run test:coverage`
- **Linting**: `npm run lint` or `npm run lint:fix`
- **Formatting**: `npm run format` or `npm run format:check`

### Available Scripts

- **`npm run analyze:patterns`**: Analyze URL patterns from test data
- **`npm run test:api`**: Test the API with real data from JSONL files
- **`npm run test:ci`**: Run tests in CI mode with coverage

The development mode uses nodemon to automatically restart the server when you make changes to TypeScript, JavaScript, or JSON files.

## Testing

The project includes comprehensive testing capabilities:

- **Unit Tests**: Test individual components and utilities
- **Integration Tests**: Test API endpoints and service interactions
- **Ground Truth Tests**: Validate parser accuracy against known good data
- **API Testing**: Automated testing with real-world data from JSONL files

### Test Data

The project includes test data for various websites:
- Wikipedia articles
- Teacher's Pay Teachers products
- Government websites (dot.ca)
- And more in the `src/tests/data/` directory

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Test API with real data
npm run test:api

# Analyze URL patterns from test data
npm run analyze:patterns
```

## Architecture

```
src/
├── api/                    # Express routes and API handlers
├── generator/              # AI parser generation (OpenAI integration)
├── services/               # Business logic services
├── storage/                # Data storage implementations (disk, in-memory)
├── tests/                  # Test suites and test data
├── utils/                  # Utility functions (logging, HTML processing, token counting)
├── types/                  # TypeScript type definitions and error handling
├── types.ts               # Main type definitions
└── index.ts               # Application entry point
```

### Key Components

- **ParserService**: Core business logic for parser management and caching
- **OpenAIService**: Handles AI parser generation with token tracking and cost estimation
- **DiskParserStorage**: Persistent storage with file-based indexing
- **HTML Extractor**: Content cleaning and preprocessing utilities
- **Logger**: Structured logging with Winston
- **Token Counter**: OpenAI API usage tracking and cost calculation

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)
- `PARSER_STORAGE_DIR`: Directory to store parser files (default: ./tmp/parsers)

## License

MIT
