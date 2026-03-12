import { createClient } from "@/lib/supabase/server";
import type { SuggestionRow } from "@/components/suggested-topics-panel";
import { SuggestionsPageClient } from "./suggestions-client";

export default async function SuggestionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all pending, non-expired suggestions
  const { data: suggestionsRaw } = await supabase
    .from("topic_suggestions")
    .select("id, title, description, categories, vote_count, user_id, expires_at")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("vote_count", { ascending: false });

  const suggestionRows = suggestionsRaw ?? [];
  const submitterIds = [...new Set(suggestionRows.map((s) => s.user_id))];
  let submitterMap: Record<string, { username: string; display_name: string }> = {};
  if (submitterIds.length > 0) {
    const { data: submitters } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", submitterIds);
    (submitters ?? []).forEach((p) => {
      submitterMap[p.id] = { username: p.username, display_name: p.display_name };
    });
  }

  const allSuggestions: SuggestionRow[] = suggestionRows.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    categories: s.categories,
    vote_count: s.vote_count,
    user_id: s.user_id,
    submitter_username: submitterMap[s.user_id]?.username ?? null,
    submitter_display_name: submitterMap[s.user_id]?.display_name ?? null,
    expires_at: s.expires_at,
  }));

  let votedIds: string[] = [];
  if (user && allSuggestions.length > 0) {
    const { data: myVotes } = await supabase
      .from("topic_suggestion_votes")
      .select("suggestion_id")
      .eq("user_id", user.id)
      .in("suggestion_id", allSuggestions.map((s) => s.id));
    votedIds = (myVotes ?? []).map((v) => v.suggestion_id);
  }

  return (
    <SuggestionsPageClient
      suggestions={allSuggestions}
      votedIds={votedIds}
      userId={user?.id ?? null}
    />
  );
}
