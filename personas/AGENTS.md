# PERSONAS — Soul Layer

25 immutable persona definitions in Portuguese. 7 category subdirectories. SHA-256 integrity enforcement (Constitution Principle I).

## STRUCTURE

```
personas/
├── .soul-hashes.json     # SHA-256 manifest — MUST regenerate after any .md edit
├── portuguese/           # Pessoa, Caeiro, Reis, Campos, Soares
├── philosophers/         # Socrates, Hegel, Diogenes
├── magicians/            # Crowley, Moore, Dee, Choronzon
├── scientists/           # Tesla, Feynman, Lovelace
├── strategists/          # Sun Tzu, Machiavelli, Vito, Michael
├── mythic/               # Hermes, Cassandra, Prometheus
└── enochian/             # Nalvage, Ave, Madimi
```

## FILE FORMAT (5 required sections)

Every `.md` file MUST pass `soul-validator.js` validation:

| # | Section | Accepted H2 Headings |
|---|---------|----------------------|
| 1 | Title | Any `# H1` — name + epithet |
| 2 | Voice | `## Voz` or `## Voice` |
| 3 | Method | `## Metodo`, `## Sistema`, `## Filosofia`, `## Natureza`, `## Funcao`, `## Mito`, `## Hermetismo`, `## Dominios`, `## Manifestacoes`, `## Origem`, `## Transformacao`, `## O Paradoxo`, `## O Sistema`, `## O Escandalo`, `## Significados` |
| 4 | Invocation | `## Quando Invocar`, `## Quando Aparece`, `## Como Usar`, `## When` |
| 5 | Bar behavior | `## Tom no Bar`, `## Bar`, `## Os Heteronimos` |

Minimum content: 100 characters. All content in **Portuguese**.

### Template

```markdown
# [Nome] — [Epiteto]

> "[Citacao na voz do personagem]"

## Dados Vitais
- **[Local, datas]**
- [Fatos biograficos]

## Sistema / Metodo / Filosofia  (pick variant)
[Identidade central. O que este personagem fundamentalmente E.]

### Conceitos-Chave
| Termo | Significado |
|-------|-------------|
| **Termo** | Definicao |

## Quando Invocar
- **Situacao tipo 1**
- **Situacao tipo 2**

## Voz
[Descricao de tom, cadencia, vocabulario]

### Exemplo de Resposta
**Pergunta:** [Exemplo]
**[Nome]:**
> [Resposta em personagem]

## Tom no Bar
[Como o personagem se manifesta fisicamente no bar "O Fim"]
```

## INTEGRITY SYSTEM

```
Edit .md file
  → npm run init-hashes              (scripts/init-soul-hashes.js)
  → personas/.soul-hashes.json       (updated SHA-256 per file)
  → git commit both files

At runtime:
  soul-validator.js reads file → SHA-256 → compares with DB personas.soul_hash
  Mismatch → persona BLOCKED (soulIntegrityFailure: true, empty systemPrompt)
  Cache: 60s TTL
```

## WHAT GETS EXTRACTED

`soul-marker-extractor.js` parses each `.md` at invocation time:

| Extracted | Source Sections | Purpose |
|-----------|----------------|---------|
| `vocabulary[]` | Bold terms (`**term**`), table keys, uppercase labels | Drift scoring — persona-specific vocabulary |
| `toneMarkers[]` | First paragraph of `## Voz` | Drift scoring — tone descriptors |
| `patterns[]` | Portuguese char frequency, em-dash usage | Structural voice fingerprint |
| `forbidden[]` | Per-persona (currently empty for all) | Overrides universal forbidden list |

## ANTI-PATTERNS

- **Editing `.md` without `npm run init-hashes`** — persona blocked at runtime (ERROR)
- **Missing any of the 5 required sections** — validation fails (ERROR)
- **Content < 100 characters** — validation fails (ERROR)
- **Adding new section heading variants** — must update regex in BOTH `soul-validator.js` AND `soul-marker-extractor.js`
- **English content** — all persona files are in Portuguese. Section headers, content, voice examples
