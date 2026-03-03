# /graph — Query Relationship Graph

Consulta o grafo de relacionamentos Neo4j para insights sobre personas.

## Argumentos

- `community` — Detectar comunidades de personas por categoria
- `neighbors [persona]` — Ver conexões diretas de uma persona
- `path [persona1] [persona2]` — Encontrar caminho entre duas personas
- `central` — Persona mais conectada no grafo
- `influence [persona]` — Cadeia de influência a partir de uma persona

## Instruções

1. Parse o argumento fornecido pelo usuário
2. Use as funções de `compute/graph-queries.js`:
   - `community` → `detectPersonaCommunities()`
   - `neighbors [persona]` → `findPersonaNeighborhood(persona)`
   - `path [a] [b]` → `findRelationshipPath(a, b)`
   - `central` → `findMostConnectedPersona()`
   - `influence [persona]` → `findInfluenceChain(persona)`
3. Formate o resultado como tabela markdown
4. Se Neo4j não estiver configurado, informe: "Neo4j não está configurado. Inicie com: `docker compose --profile graph up -d`"

## Exemplos

```
/graph community
/graph neighbors hegel
/graph path socrates diogenes
/graph central
/graph influence moore
```
