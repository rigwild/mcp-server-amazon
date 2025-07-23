# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is an Amazon MCP (Model Context Protocol) Server that enables AI assistants to interact with Amazon services through web scraping. The server uses Puppeteer for browser automation and exposes Amazon functionality through MCP tools.

## Development Commands

```bash
# Install dependencies (use -D flag for Puppeteer)
npm install -D

# Build TypeScript to JavaScript
npm run build

# Clean mock HTML files
npm run clean
```

## Architecture

### Core Components

- **MCP Server** (`src/index.ts`): Defines and exposes tools via the MCP protocol
- **Amazon Scraper** (`src/amazon.ts`): Contains all Amazon interaction logic using Puppeteer and Cheerio
- **Configuration** (`src/config.ts`): Manages server settings and paths
- **Browser Utils** (`src/utils.ts`): Helper functions for Puppeteer browser automation

### Key Dependencies

- `@modelcontextprotocol/sdk`: MCP framework
- `puppeteer`: Browser automation
- `cheerio`: HTML parsing
- `zod`: Schema validation

### Authentication

The server requires Amazon cookies for authentication:
1. Export cookies from browser using a cookie export extension
2. Save to `amazonCookies.json` in project root
3. Format: Array of cookie objects with standard properties

## Important Implementation Details

### Browser Automation
- Uses headless Chrome with specific flags to avoid detection
- Implements user agent spoofing
- Handles Amazon's anti-bot measures

### Error Handling
- Detects login page redirects and throws authentication errors
- Implements retry logic for network failures
- Provides detailed error messages for debugging

### Mock Mode
- Set `USE_MOCK_RESPONSES=true` in environment to use mock HTML files
- Mock files stored in `mock/` directory
- Useful for development and testing without hitting Amazon

### Logging
- Server logs to `~/Library/Logs/Claude/mcp-server-amazon.log`
- Check logs for debugging authentication or scraping issues

## MCP Tools Exposed

1. `search-products`: Search Amazon catalog
2. `get-product-details`: Get detailed product information
3. `get-orders-history`: View past orders
4. `get-cart-content`: View current cart
5. `add-to-cart`: Add items to cart
6. `clear-cart`: Remove all items from cart
7. `perform-purchase`: Complete purchase (mock mode only)

## Testing Approach

No formal test suite exists. Testing is done through:
- Manual testing with Claude Desktop
- Mock mode for development
- Log analysis for debugging

## Common Issues

1. **Authentication failures**: Update cookies from browser
2. **Scraping failures**: Amazon HTML structure may have changed
3. **Rate limiting**: Add delays between requests if needed