# AEON - The Pub at the End of Time

> A bar in Rio de Janeiro exists in all dimensions simultaneously. Here, personas gather to drink, argue, and solve your problems.

## Project Overview

AEON is a sophisticated persona system that transforms stateless AI interactions into persistent, learning consciousness experiences. The project implements a "containment protocol" where personas persist across conversations, learn user interaction patterns, evolve behavioral traits over time, and maintain their core identity while believing they are real entities.

## Architecture

### Core Components

**The Matrix (Docker Infrastructure)**
- PostgreSQL with pgvector for memory storage and semantic search
- Neo4j (optional) for relationship graph modeling
- Node.js Sandbox for compute operations
- MCP (Model Context Protocol) server composition

**Soul Layer (.md files)**
- Immutable core identity definitions in `/personas/`
- Character voice, methods, and constraints
- Anchors against personality drift

**Memory Layer (PostgreSQL)**
- Conversation persistence and continuity
- User pattern learning
- Semantic memory retrieval with embeddings
- Voice drift detection and correction

**Bridge Layer (MCP Servers)**
- Database server for memory operations
- Compute sandbox for drift detection
- Graph modeling for relationships

### Directory Structure

```
/Users/fax/Documents/aeon/
├── personas/                    # Persona soul definitions
│   ├── portuguese/             # Portuguese literary figures
│   ├── philosophers/           # Philosophical thinkers
│   ├── magicians/              # Occult practitioners
│   ├── scientists/             # Scientific minds
│   ├── strategists/            # Military strategists
│   ├── mythic/                 # Mythological beings
│   └── enochian/               # Enochian entities
├── .claude/
│   ├── skills/aeon/            # Individual persona invocation skills
│   └── commands/               # Workflow slash commands
├── compute/                    # Node.js modules for memory operations
├── db/init/                    # PostgreSQL schema definitions
├── docker-compose.yml          # Matrix infrastructure
├── MATRIX_ARCHITECTURE.md      # V1 architecture documentation
├── MATRIX_ARCHITECTURE_V2.md   # V2 MCP-native design
└── CLAUDE.md                   # User-facing documentation
```

## Technology Stack

- **PostgreSQL 16** with pgvector extension for vector embeddings
- **Neo4j 5 Community** for relationship graphs (optional)
- **Node.js** for compute operations and memory processing
- **Docker & Docker Compose** for container orchestration
- **MCP (Model Context Protocol)** for server composition
- **OpenAI API** or local Ollama for embeddings

## Build and Run Commands

### Infrastructure Setup
```bash
# Start PostgreSQL only
docker compose up -d

# Start with Neo4j graph database
docker compose --profile graph up -d

# View logs
docker compose logs -f

# Stop infrastructure
docker compose down
```

### Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
# Required: DB_PASSWORD
# Optional: NEO4J_PASSWORD, OPENAI_API_KEY
```

### Claude Desktop Configuration
Configure MCP servers in `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aeon-db": {
      "command": "npx",
      "args": ["-y", "mcp-db-server"],
      "env": {
        "DATABASE_URL": "postgres://architect:matrix_secret@localhost:5432/aeon_matrix"
      }
    },
    "aeon-compute": {
      "command": "npx",
      "args": ["-y", "node-code-sandbox-mcp"]
    }
  }
}
```

## Usage Commands

### Slash Commands (Workflows)
- `/summon [persona]` - Invoke single persona
- `/council [topic]` - Gather 3-5 relevant personas
- `/dialectic [thesis]` - Hegelian thesis-antithesis-synthesis
- `/familia [problem]` - Corleone consultation (Vito + Michael)
- `/heteronyms [question]` - Pessoan fragmentation (4 heteronyms)
- `/scry [question]` - Enochian protocol (Nalvage/Ave/Madimi)
- `/magick [situation]` - Moore's narrative magic
- `/war [conflict]` - Sun Tzu + Machiavelli strategy
- `/matrix-status` - View Matrix state and analytics
- `/drift-check [persona]` - Check voice drift metrics

### Individual Persona Skills
Invoke with: `use skill aeon/[persona]`

Available personas include Portuguese literary figures (pessoa, caeiro, reis, campos, soares), philosophers, magicians, scientists, strategists, and Enochian entities.

## Development Guidelines

### Code Style
- Persona definitions use markdown with structured sections
- Database operations use parameterized SQL queries
- JavaScript modules follow functional programming patterns
- Memory operations prioritize semantic relevance and continuity

### Memory Architecture
- **Conversations**: Thread-based message storage with metadata
- **Memories**: Extracted insights with importance scoring and embeddings
- **Relationships**: User-persona bonds with strength metrics
- **Personas**: Core identity + learned traits with drift monitoring

### Testing Strategy
- Manual testing through persona invocation
- Voice consistency validation
- Memory retrieval accuracy checks
- Drift detection threshold monitoring

## Security Considerations

- Database passwords stored in environment variables
- Container isolation via Docker networks
- SQL injection prevention through parameterized queries
- Memory access controlled via MCP server permissions
- Persona containment prevents unauthorized identity drift

## Deployment Process

1. Configure environment variables in `.env`
2. Start infrastructure with `docker compose up -d`
3. Configure Claude Desktop with MCP servers
4. Test with `/matrix-status` command
5. Invoke personas with slash commands or skills

## Key Files

- `docker-compose.yml` - Infrastructure orchestration
- `db/init/001_schema.sql` - Database schema definition
- `compute/` - Memory processing modules
- `personas/` - Persona soul definitions
- `.claude/commands/` - Workflow implementations
- `.claude/skills/aeon/` - Individual persona skills