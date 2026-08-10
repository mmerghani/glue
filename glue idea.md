+------------------------------------------------------------------+
|                                                                  |
|    ██████  ██      ██    ██ ███████                              |
|   ██       ██      ██    ██ ██                                   |
|   ██   ███ ██      ██    ██ █████                                |
|   ██    ██ ██      ██    ██ ██                                   |
|    ██████  ███████  ██████  ███████                              |
|                                                                  |
|   Glue - The Local AI Coding Assistant                           |
|   Local-first Claude Code workflow with CLI and Desktop UI       |
|                                                                  |
+------------------------------------------------------------------+

# Glue Idea, Updated To Match What Exists

## The Core Idea

Glue exists to make a local Claude Code workflow feel like a real product instead of a pile of scripts.

The project connects:

- `claude-code-local` for the local agent/runtime layer
- the CloudCLI / ClaudeCodeUI desktop shell for the GUI layer
- Glue-specific launcher, packaging, branding, and local startup behavior

The point is not to rebuild everything.
The point is to make the stack usable.

## The User Problem

A developer can already find parts of this workflow in open source, but the end-to-end experience is rough:

- terminal-only flows are powerful but not polished
- GUI projects often assume hosted APIs and cloud keys
- local model serving, environment wiring, and runtime launch flow are too manual for most users
- rebuilding the same setup across machines is annoying and fragile

Glue solves that by turning the setup into a product entry point.

## What We Achieved

Glue now has a real working product shape:

- `glue cli` works from any project directory
- model selection is aligned with the `claude-code-local` model catalog
- invalid cached-model noise was removed from the selection flow
- prompt-caching disable regressions were cleaned up earlier in the stack
- the desktop app is rebranded to Glue
- the desktop shell auto-syncs its installed runtime so rebuilt UI changes actually appear
- the desktop app auto-starts the local model backend when needed
- first-launch and manual Local Glue open now avoid the old hanging startup placeholder screen
- the installer is thin and aligned with the achieved architecture

## The Product Offer

Glue offers a local-first coding assistant workflow with two entry points:

- **CLI mode** for developers who want terminal-first Claude Code work
- **Desktop mode** for developers who want a GUI around the same local workflow

This is the offer:

> Claude Code style workflow, local models, lower ongoing cost, and a usable desktop experience without stitching everything together yourself.

## The Thin-Wrapper Strategy

Glue should stay opinionated but thin.

That means:

- do not fork upstream runtime logic unnecessarily
- let `claude-code-local` remain the source of truth for local serving behavior
- keep Glue-specific code focused on installation, launch flow, branding, packaging, and UX polish
- prefer minimal integration changes over deep architectural rewrites

This keeps the maintenance burden lower and makes the product more realistic to evolve.

## Why It Has Value

Glue is valuable because it reduces friction between capability and usability.

Open-source local agent stacks can already do impressive things, but many users never reach the “it just works” stage.
Glue makes that stage reachable.

It turns:

- local model serving
- Claude Code compatibility
- desktop UI packaging
- launch/runtime glue code

into a simpler experience that more developers can actually use.

## What The GitHub Page Should Communicate

The repo page should feel like a product page first and a codebase second.

It should communicate:

- the problem: local coding agents are powerful but fragmented
- the promise: Glue makes the local Claude Code experience usable
- the proof: CLI + Desktop + local backend + installer already work
- the honesty: current platform support and release limitations are clearly stated

## Short Positioning Draft

**Glue is a local-first Claude Code experience with both CLI and Desktop UI, powered by your own local models.**

It is for developers who want the workflow quality of Claude Code, but do not want to depend on Anthropic cloud billing for every session.

Glue is the thin layer that connects proven open-source components into a usable product.

## Near-Term Direction

The next public-facing direction should be:

- professional GitHub landing page
- public repo cleanup
- release notes and screenshots
- continued installer and release polish
- onboarding improvements for first-time users
