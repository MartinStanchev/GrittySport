# Aura Kinetic — Chat Proposals Redesign

## Summary
Complete redesign of the chat proposal UI and app-wide color palette, adopting the "Aura Kinetic" design system from Stitch.

## Changes

### App-Wide Theme Overhaul
- Replaced both light and dark mode color palettes with Aura Kinetic colors
- Dark: deep navy (#12121d) background, lavender (#cebdff) primary, cyan (#46eaed) secondary, orange (#ffb868) tertiary
- Light: lavender-tinted white (#F5F3FF) background, purple (#7C5CFC) primary, teal (#0EA5B0) secondary
- Added new color tokens: `secondary`, `tertiary`, `glass`

### Custom Fonts
- Installed Space Grotesk (headings) and Inter (body) via @expo-google-fonts
- Created `constants/fonts.ts` with font family constants
- Applied fonts to chat UI, proposal cards, and key HomeScreen text elements

### Program Proposal Card (Compact Inline)
- Transformed from detailed accordion card to compact inline card
- Shows: "PROGRAM PROPOSAL" badge, program name, goal description, "REVIEW PROGRAM" CTA
- Glass-morphism styling with semi-transparent background

### Proposal Review View (New)
- Full-screen review inside the chat modal (state-driven swap)
- Shows: header with back nav, sport badge, program title, goal, stat circles (weeks/days/phases)
- Phase accordion with expandable activity lists showing day labels, icons, activity types
- Rest days displayed as distinct rows
- Sticky bottom bar with "ACCEPT PROGRAM" and "REQUEST CHANGES" buttons

### Program Edit Card
- Restyled with Aura Kinetic aesthetic
- Color-coded edit actions: cyan (add), coral (remove), orange (update), lavender (swap)
- Structured header with icon and change count
- Scope indicator with info icon

### HomeScreen Integration
- Added `reviewingProposal` state for modal view switching
- ProposalReviewView replaces chat FlatList when reviewing
- Accept/deny from review screen routes through existing WebSocket flow
- Updated chat bubble and markdown styles with new fonts and colors

## Key Files Changed
- `frontend/App.tsx` — font loading
- `frontend/src/constants/colors.ts` — full palette overhaul
- `frontend/src/constants/fonts.ts` — new file
- `frontend/src/components/ProgramProposalCard.tsx` — redesigned
- `frontend/src/components/ProposalReviewView.tsx` — new file
- `frontend/src/components/ProgramEditCard.tsx` — redesigned
- `frontend/src/screens/HomeScreen.tsx` — review integration, chat styling
