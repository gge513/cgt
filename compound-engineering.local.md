---
review_agents:
  - kieran-typescript-reviewer
  - security-sentinel
  - performance-oracle
  - architecture-strategist
  - pattern-recognition-specialist
---

# Review Focus Areas

## System Overview
This is a unified transcript analysis system with:
- **Backend**: Node.js CLI with TypeScript, Claude API integration
- **Frontend**: Next.js web dashboard with Zustand state management
- **Features**: Transcript conversion, multi-agent analysis, Knowledge Management System (KMS)
- **Testing**: 79 tests covering integration, manifest, metadata, validation

## Recent Changes
- Wired CLI commands to orchestration functions (fixing stubbed TODOs)
- Built Next.js KMS web dashboard with relationship validator
- Integrated with existing CLI and caching systems

## Key Architectural Concerns
1. **Type Safety**: TypeScript configuration unification across CLI and Next.js
2. **Caching Strategy**: Smart manifest-based caching with per-model results
3. **Agent Patterns**: Three specialist agents (Synthesizer, Strategist, Impact Analyst)
4. **State Management**: Zustand for dashboard UI state, JSON files for CLI persistence
5. **API Integration**: Anthropic SDK usage patterns and error handling

## Code Quality Standards
- Zero TypeScript compilation errors required
- All tests must pass (79 test baseline)
- Security-first validation at system boundaries
- Minimal, focused changes (no over-engineering)
- Clear separation between CLI and web layers
