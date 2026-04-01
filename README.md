# Quip MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for reading Quip documents and spreadsheets. Works with Claude Desktop and any MCP-compatible client.

## Quick Setup

Run the setup script — it will prompt for your Quip token and configure Claude Desktop automatically:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/yashjain/quip-mcp/main/setup.sh)
```

Or manually add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "quip": {
      "command": "npx",
      "args": [
        "-y",
        "@yashj645/quip-mcp-server",
        "--storage-path",
        "/Users/yourname/.quip-mcp/storage",
        "--file-protocol"
      ],
      "env": {
        "QUIP_TOKEN": "your_quip_api_token"
      }
    }
  }
}
```

Get your Quip API token from: `https://your-quip-domain.quip.com/dev/token`

## Installation

```bash
# Run directly with npx (no install needed)
npx @yashj645/quip-mcp-server

# Or install globally
npm install -g @yashj645/quip-mcp-server
```

Requires Node.js v18+.

## Available Tools

### `quip_read_document`

Reads the text content of a regular Quip document (not a spreadsheet).

**Parameters:**
- `threadId` (required): The Quip thread ID (part of the URL after your Quip domain)

**Example:**
```json
{ "threadId": "AbCdEfGhIjKl" }
```

**Response:**
```json
{
  "thread_id": "AbCdEfGhIjKl",
  "title": "My Document",
  "type": "document",
  "text_content": "Full plain text content of the document...",
  "word_count": 342
}
```

---

### `quip_read_spreadsheet`

Reads a Quip spreadsheet and returns its content as CSV.

**Parameters:**
- `threadId` (required): The Quip thread ID
- `sheetName` (optional): Name of the sheet to read. Defaults to the first sheet.

**Example:**
```json
{ "threadId": "AbCdEfGhIjKl", "sheetName": "Sheet1" }
```

**Response:**
```json
{
  "csv_content": "header1,header2\nvalue1,value2\n...",
  "metadata": {
    "total_rows": 1000,
    "total_size": 52840,
    "is_truncated": true,
    "resource_uri": "file:///Users/yourname/.quip-mcp/storage/AbCdEfGhIjKl-Sheet1.csv"
  }
}
```

Content is truncated at 10KB in the response. The full CSV is saved locally and accessible via `resource_uri`.

---

**Finding the Thread ID**: It's the segment in the Quip URL right after your domain.  
Example: `https://yourcompany.quip.com/S6eaArZiT0xy/Doc-Title` → thread ID is `S6eaArZiT0xy`

## Usage with Claude

Once set up, ask Claude:

- `"Read the Quip document with thread ID S6eaArZiT0xy"`
- `"Read the Quip spreadsheet with thread ID AbCdEfGhIjKl"`
- `"Read the sheet named 'Q1 Data' from the Quip spreadsheet AbCdEfGhIjKl"`

## Command Line Arguments

| Argument | Description | Default |
|---|---|---|
| `--storage-path <path>` | Where to store CSV files locally | `~/.quip-mcp-server/storage` |
| `--file-protocol` | Use `file://` URIs for resource access | off |
| `--port <port>` | Run as HTTP server on this port | stdio mode |
| `--mock` | Use mock data (no Quip token needed) | off |
| `--debug` | Enable debug logging | off |
| `--storage-type <type>` | `local` or `s3` | `local` |
| `--s3-bucket <name>` | S3 bucket (when using S3 storage) | — |
| `--s3-region <region>` | S3 region | — |

## Environment Variables

```bash
QUIP_TOKEN=your_token           # Required (unless --mock)
QUIP_BASE_URL=https://platform.quip.com  # Optional
QUIP_STORAGE_PATH=/path/to/storage       # Optional
STORAGE_TYPE=local              # 'local' or 's3'
```

## HTTP Mode (for team sharing)

Run as a shared HTTP server so others on your team can connect without installing anything locally:

```bash
QUIP_TOKEN=your_token npx @yashj645/quip-mcp-server --port 3000
```

Others then configure:
```json
{
  "mcpServers": {
    "quip": {
      "url": "http://your-server:3000/mcp"
    }
  }
}
```

## Development

```bash
git clone https://github.com/yashj645/quip-mcp-server.git
cd quip-mcp-server
npm install
npm run build
npm test
```

**Mock mode** (no Quip token needed):
```bash
node dist/index.js --mock --storage-path ./storage
```

## License

MIT
