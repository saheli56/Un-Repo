---
applyTo: '**'
---

# User Memory

## User Preferences
- Programming languages: TypeScript, React
- Code style preferences: Concise, Tailwind/shadcn UI components
- Development environment: VS Code on Windows, PowerShell shell
- Communication style: Short, impersonal updates; actionable steps

## Project Context
- Current project type: Web app for exploring GitHub repos with AI
- Tech stack: Vite + React + TypeScript + Tailwind/shadcn; custom analyzers; Gemini integration
- Architecture patterns: SPA with panels (Explorer, Interactive), lib services
- Key requirements: Add GitHub OAuth login and list user repositories

## Coding Patterns
- Prefer localStorage-backed settings for tokens/keys
- UI composed of Card/Button/Input from ui components
- Animations via framer-motion

## Conversation History
- Fixed visualization layout, added Gemini AI panels, removed Network View
- Planned and implemented GitHub login and repo listing
- Moved repository listing to a dedicated Repos view accessed from header when logged in

## Notes
- OAuth server added under server/ using Express with PKCE; Vite proxy /api to server
