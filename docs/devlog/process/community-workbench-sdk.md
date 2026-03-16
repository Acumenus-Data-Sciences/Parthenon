# Community Workbench SDK

## Purpose

Parthenon now includes an in-repo starter kit for building optional workbench tools using the same architectural pattern established by the FINNGEN integration.

The SDK lives at:

- [community-workbench-sdk/README.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/README.md)

It is intended to support:

- community-built workbench tools
- partner modernization efforts
- internal scaffolding for new optional tool domains
- AI-assisted generation of starter assets with explicit contracts

## Why It Exists

Without a starter, developers have to reverse-engineer multiple layers:

- StudyAgent tool registration
- service discovery metadata
- backend request orchestration
- persisted run shaping
- frontend workbench UX

The SDK reduces that friction by shipping:

- contract schemas
- generator script
- tokenized templates
- detailed documentation for humans and AI assistants

## Main Entry Points

- [README.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/README.md)
- [START_HERE.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/docs/START_HERE.md)
- [AI_ASSISTANT_GUIDE.md](/home/smudoshi/Github/Parthenon/community-workbench-sdk/docs/AI_ASSISTANT_GUIDE.md)
- [new-workbench-tool.sh](/home/smudoshi/Github/Parthenon/community-workbench-sdk/scripts/new-workbench-tool.sh)

## What Is Included

### Contracts

The SDK defines JSON Schemas for:

- service descriptors
- runtime metadata
- result envelopes
- artifact manifests

These give both frontend and backend developers, as well as AI coding assistants, explicit payload expectations.

### Templates

The SDK includes tokenized starter files for:

- service registry entries
- StudyAgent MCP tool modules
- Laravel controllers and services
- frontend pages and types

### Generator

The generator stamps a tool scaffold into a target directory and leaves host repo integration as an explicit manual step.

This is intentional. It keeps the process reviewable and avoids hidden modifications to the main codebase.

## Usage Model

1. Generate a scaffold into a scratch directory.
2. Review the generated files.
3. Integrate the relevant assets into the host repo.
4. Replace placeholder logic with domain-specific behavior.
5. Add tests and run validation.

## AI Assistant Support

The SDK is documented so AI assistants can work predictably:

- normative files are identified
- payload contracts are explicit
- token placeholders are documented
- host integration boundaries are spelled out

This should reduce hallucinated payload shapes and reduce unsafe shortcuts during scaffold generation.

## Current Scope

The current SDK implementation is an initial starter pack. It is not yet a full packaging system or marketplace.

It provides:

- a practical generator
- contract baselines
- starter templates
- documentation

Future work can extend it with:

- release zip packaging
- schema validation scripts
- example fixtures and screenshots
- acceptance criteria for officially listed community tools
