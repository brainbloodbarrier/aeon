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

## Coding Rules

### Security

**Validate persona names against directory traversal** (ERROR)
Any function receiving a persona name to construct a file path must sanitize input. Strip or reject `..`, `/`, `\`, and null bytes. Validate the resolved path stays within PERSONAS_DIR using `path.resolve()` + `startsWith()`. Applies to `soul-marker-extractor.js`, `soul-validator.js`, and any module reading persona files by name.

**Never expose operator_logs content to users** (ERROR)
Constitution Principle II mandates invisible infrastructure. Any endpoint, response, or context injection that leaks data from `operator_logs` violates the architecture. Operator logs are exclusively for system diagnostics.

**Do not hard-code database passwords; load from environment variables** (WARNING)
All database credentials must come from `process.env` or a secret manager. Connection strings must not contain literal passwords. Config examples must use placeholders like `CHANGE_ME`.

**Use parameterized SQL for all database operations** (WARNING)
Every database call must use driver-appropriate placeholders (`$1`, `$2` for pg). Never use string interpolation, concatenation, or template literals to build SQL with variables. All external input is untrusted.

### Correctness

**Match SQL function signatures to JS callers** (ERROR)
SQL functions (`log_operation`, `get_context_template`, etc.) must accept the exact number and types of parameters that the JS code passes. Mismatches cause silent runtime failures caught by catch blocks.

**Check return shape before accessing properties** (ERROR)
When a function returns an object, guard conditions must check properties that actually exist on the return value. Never check for nonexistent properties — `undefined` is falsy and silently disables code paths.

**Use lowercase constants for ARC_PHASES** (WARNING)
All phase values must use lowercase (`'rising'`, `'apex'`, `'falling'`, `'impact'`) matching the `ARC_PHASES` constants in `narrative-gravity.js`. Uppercase variants produce mismatches in comparisons and logs.

**Order Jest ESM mocks before importing the module under test** (WARNING)
All `jest.unstable_mockModule()` calls must appear before any `await import()` of the module under test. Static `import` statements bypass mocks entirely. The module under test must always be dynamically imported after mock setup.

### Testability

**Unit tests must mock shared DB pool module** (WARNING)
All unit test files that import compute modules must mock `../../compute/db-pool.js` with `getSharedPool: jest.fn(() => mockPool)`. Never establish real database connections in unit tests.

**Mock operator-logger.js in all compute unit tests** (WARNING)
Any test file for a compute module that imports `operator-logger.js` must mock it to prevent transitive database access. Use `jest.unstable_mockModule('../../compute/operator-logger.js', () => ({ logOperation: jest.fn() }))`.

**Never use bare return to skip tests; use test.skip** (WARNING)
When tests need to be conditionally skipped (e.g., no database available), use `test.skip()` or `describe.skip()` instead of `if (!condition) return`. Bare returns produce phantom passes in CI output.

### Architecture

**All compute modules must use getSharedPool() from db-pool.js** (ERROR)
No compute module may import `pg` directly or create its own Pool instance. All database access goes through `getSharedPool()` from `compute/db-pool.js`. This ensures centralized connection management and fatal error recovery.

**Soul file modifications require hash regeneration** (ERROR)
Any edit to files in `personas/**/*.md` must be followed by `node scripts/init-soul-hashes.js` and committing the updated `personas/.soul-hashes.json`. Stale hashes cause the soul validator to reject personas at runtime (Constitution Principle I).

**Context assembly helpers must fail silently with null** (WARNING)
All `safe*Fetch` functions in `context-assembler.js` must catch errors and return `null`. Exceptions must never propagate upward — a failing subsystem (entropy, bleed, narrative gravity) must not break context assembly for the user.

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