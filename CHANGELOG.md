# Changelog

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
