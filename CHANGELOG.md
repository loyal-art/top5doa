# Changelog

## Session 9 — Voter Archetype Identity System

### Archetype Engine
- Client-side scoring engine (`src/lib/archetypes.ts`) — matches user attribute rankings against archetype weight profiles using weighted dot product
- Rank-to-weight conversion: rank 1 = N points, rank 2 = N-1, etc.
- Secondary archetype detection when primary margin < 15%
- Dynamic explanation generator — runtime-generated personalized text referencing user's #1 and #2 attributes
- Secondary archetype phrasing: "With a touch of...", "Leaning...", "You've got some... in you"

### Archetype Reveal (Post Lock-In)
- Full-screen cinematic reveal overlay after voting lock-in
- 5-phase animation sequence: intro text → icon + name with gold glow → base description + dynamic explanation → secondary archetype → fade out
- Gold pulsing `archetype-glow` text animation
- "Tap to continue" skip option
- Archetype identity card displayed on locked-in results view

### AI Archetype Generation (Admin)
- `/api/ai/generate-archetypes` API route using Claude to generate 5 distinct archetypes per topic
- System prompt tuned for identity-style naming ("The ___" format), personality descriptions, and attribute weight assignment (1-5 scale)
- Admin panel "Archetypes" section — select topic, generate preview, save/delete/regenerate
- Preview shows archetype names, descriptions, icons, and per-attribute weight badges

### Poster & Share Card Integration
- Archetype identity badge on share card (below rankings, above footer)
- Archetype overlay on AI poster composite (top-right corner, glass-blur background)
- Both show icon + name + secondary phrase when applicable

### Profile — YOUR IDENTITIES
- New section on profile page between "Voted On" and "My Posters"
- Shows all archetype results: topic name, archetype icon + name, secondary archetype
- Each entry links back to the topic

### Schema
- `topic_archetypes` table — id, topic_id, name, base_description, icon, attribute_weights (jsonb), RLS policies (public read, admin write)
- `user_archetypes` table — id, user_id, topic_id, primary/secondary archetype IDs, scores, margin, unique per user+topic, RLS policies (public read, user write own)
- TypeScript types added to `database.ts`

## Session 8 — Select Subjects, OAuth Fix, Branding & Logo

### Voting Flow
- Select Subjects step between Rank Attributes and Score Subjects — users choose which subjects to rate (minimum 5). Unselected subjects auto-scored at lowest selected score minus 1 per attribute at lock-in
- Subject thumbnails in Select Subjects checklist (when link_photo exists)
- Scroll to top on all 6 voting navigation paths (prev/next subject, prev/next attribute, dot nav)

### Auth
- Google OAuth fully fixed — switched to popup-based flow to bypass Chrome bounce tracking mitigation, fixed handle_new_user() trigger to use public.profiles schema reference
- All new signups now receive 1 month premium access (removed 50-user cap)

### Home Page
- Hero banner redesigned — two-column layout with featured topic video/GIF on right side
- is_featured boolean on topics with admin toggle — only one topic featured at a time
- Hero text: "DEBATE THE GREATS. CREATE AND SHARE YOUR TOP 5 DOA."
- How It Works section (guest-only, 3 steps)
- Category nav emojis (🏈 NFL, 🏀 NBA, etc.)
- Category nav moved above How It Works
- Left sidebar: removed duplicate categories panel, moved Trending Now from right to left
- Right sidebar reordered: Suggest a Topic → Suggested Topics → Coming Soon
- Topic search bar with client-side filtering
- Client-side pagination (12 topics per page, Load More button)

### Branding
- Gold glowing "TOP" and "5" in all topic titles — #FFD700 pulsing brandGlow animation via reusable brandHighlight() utility
- Official logo: TOP 5 diamond shield with "dead or alive..." — header logo at 64px, T5P as favicon
- Username glow indicator (#e8ff00) when signed in
- "Submit a Topic" renamed to "Suggest a Topic"

### Admin
- Manage Suggestions section — view, approve, reject, delete topic suggestions
- RLS policies for admin suggestion management

**Backlog: 63 done, 20 remaining**
