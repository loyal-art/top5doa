"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { awardAura } from "@/lib/aura";

async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, userId: null, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin)
    return { supabase: null, userId: null, error: "Not authorized" };

  return { supabase, userId: user.id, error: null };
}

export async function createTopic(
  formData: FormData
): Promise<{ error: string | null }> {
  const { supabase, userId, error: authError } = await getAdminUser();
  if (authError || !supabase || !userId) return { error: authError ?? "Auth failed" };

  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const category = formData.getAll("category") as string[];
  const description = (formData.get("description") as string) || null;
  const status = (formData.get("status") as string) || "active";

  const { data: newTopic, error } = await supabase
    .from("topics")
    .insert({
      title,
      slug,
      category,
      description,
      status: status as "draft" | "coming_soon" | "active" | "archived",
      creator_id: userId,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Fan-out notifications to premium users who subscribed to any of the topic's categories.
  // Non-blocking — topic creation succeeds even if the RPC fails.
  if (newTopic) {
    for (const cat of category) {
      await supabase.rpc("notify_new_topic", {
        p_topic_id: newTopic.id,
        p_category: cat,
        p_title: title,
      });
    }
    // Award +20 Aura to the creator
    await awardAura(supabase, userId, "create_topic", newTopic.id);
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

export async function addSubject(
  formData: FormData
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  const topic_id = formData.get("topic_id") as string;
  const name = formData.get("name") as string;
  const era = (formData.get("era") as string) || null;
  const link_photo = (formData.get("link_photo") as string) || null;
  const link_music = (formData.get("link_music") as string) || null;
  const link_video = (formData.get("link_video") as string) || null;

  const { error } = await supabase.from("subjects").insert({
    topic_id,
    name,
    era,
    link_photo,
    link_music,
    link_video,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { error: null };
}

export async function addSubjectsBulk(
  formData: FormData
): Promise<{ error: string | null; count?: number }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  const topic_id = formData.get("topic_id") as string;
  const raw = formData.get("names") as string;

  const names = raw
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  if (names.length === 0) return { error: "No names provided" };

  const rows = names.map((name) => ({ topic_id, name }));

  const { error } = await supabase.from("subjects").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { error: null, count: names.length };
}

export async function addAttributesBulk(
  formData: FormData
): Promise<{ error: string | null; count?: number }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  const topic_id = formData.get("topic_id") as string;
  const raw = formData.get("names") as string;

  const names = raw
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  if (names.length === 0) return { error: "No names provided" };

  const rows = names.map((name) => ({ topic_id, name, status: "active" as const }));

  const { error } = await supabase.from("attributes").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { error: null, count: names.length };
}

export async function addAttribute(
  formData: FormData
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  const topic_id = formData.get("topic_id") as string;
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;

  const { error } = await supabase.from("attributes").insert({
    topic_id,
    name,
    description,
    status: "active",
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { error: null };
}

export async function getSubjectsForTopic(topic_id: string): Promise<{
  data: Array<{
    id: string;
    name: string;
    description: string | null;
    era: string | null;
    link_photo: string | null;
    link_music: string | null;
    link_video: string | null;
    video_url: string | null;
    sort_order: number;
  }> | null;
  error: string | null;
}> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { data: null, error: authError ?? "Auth failed" };

  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, description, era, link_photo, link_music, link_video, video_url, sort_order")
    .eq("topic_id", topic_id)
    .order("sort_order")
    .order("name");

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function getAttributesForTopic(topic_id: string): Promise<{
  data: Array<{ id: string; name: string; description: string | null }> | null;
  error: string | null;
}> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { data: null, error: authError ?? "Auth failed" };

  const { data, error } = await supabase
    .from("attributes")
    .select("id, name, description")
    .eq("topic_id", topic_id)
    .order("name");

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function updateSubject(
  id: string,
  updates: {
    name: string;
    description: string | null;
    era: string | null;
    link_photo: string | null;
    link_music: string | null;
    link_video: string | null;
    video_url: string | null;
    sort_order?: number;
  }
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  const { error } = await supabase.from("subjects").update(updates).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

export async function updateAttribute(
  id: string,
  updates: { name: string; description: string | null }
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  const { error } = await supabase.from("attributes").update(updates).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { error: null };
}

export async function getTopics(): Promise<{
  data: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string[];
    status: string;
    cover_image_url: string | null;
    card_image_url: string | null;
    card_video_url: string | null;
    video_url: string | null;
    is_featured: boolean;
  }> | null;
  error: string | null;
}> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { data: null, error: authError ?? "Auth failed" };

  const { data, error } = await supabase
    .from("topics")
    .select("id, title, description, category, status, cover_image_url, card_image_url, card_video_url, video_url, is_featured")
    .order("title");

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function updateTopic(
  id: string,
  updates: {
    title: string;
    description: string | null;
    category: string[];
    status: "draft" | "coming_soon" | "active" | "archived";
    cover_image_url: string | null;
    card_image_url: string | null;
    card_video_url: string | null;
    video_url: string | null;
    is_featured: boolean;
  }
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  // If setting this topic as featured, unset all other featured topics first
  if (updates.is_featured) {
    await supabase
      .from("topics")
      .update({ is_featured: false })
      .neq("id", id)
      .eq("is_featured", true);
  }

  const { error } = await supabase.from("topics").update(updates).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

export async function createTopicWithContent(data: {
  title: string;
  slug: string;
  category: string[];
  description: string | null;
  status: string;
  subjects: { name: string; description: string | null; era: string | null }[];
  attributes: { name: string; description: string | null }[];
  created_by?: string | null;
}): Promise<{ error: string | null; topicId: string | null }> {
  const { supabase, userId, error: authError } = await getAdminUser();
  if (authError || !supabase || !userId)
    return { error: authError ?? "Auth failed", topicId: null };

  // created_by: use the provided user (e.g. suggestion submitter), fall back to admin
  const createdBy = data.created_by ?? userId;

  // 1. Create topic
  const { data: newTopic, error: topicError } = await supabase
    .from("topics")
    .insert({
      title: data.title,
      slug: data.slug,
      category: data.category,
      description: data.description,
      status: data.status as "draft" | "coming_soon" | "active" | "archived",
      creator_id: userId,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (topicError) return { error: topicError.message, topicId: null };

  const topicId = newTopic.id;

  // 2. Bulk insert subjects
  if (data.subjects.length > 0) {
    const subjectRows = data.subjects.map((s) => ({
      topic_id: topicId,
      name: s.name,
      description: s.description,
      era: s.era,
    }));
    const { error: subErr } = await supabase.from("subjects").insert(subjectRows);
    if (subErr) return { error: `Topic created but subjects failed: ${subErr.message}`, topicId };
  }

  // 3. Bulk insert attributes
  if (data.attributes.length > 0) {
    const attrRows = data.attributes.map((a) => ({
      topic_id: topicId,
      name: a.name,
      description: a.description,
      status: "active" as const,
    }));
    const { error: attrErr } = await supabase.from("attributes").insert(attrRows);
    if (attrErr) return { error: `Topic+subjects created but attributes failed: ${attrErr.message}`, topicId };
  }

  // Fan-out notifications
  for (const cat of data.category) {
    await supabase.rpc("notify_new_topic", {
      p_topic_id: topicId,
      p_category: cat,
      p_title: data.title,
    });
  }

  // Award +20 Aura to the creator
  await awardAura(supabase, createdBy, "create_topic", topicId);

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null, topicId };
}

export async function getTopicSuggestions(): Promise<{
  data: Array<{
    id: string;
    title: string;
    description: string | null;
    categories: string[];
    vote_count: number;
    status: string;
    expires_at: string;
    created_at: string;
    user_id: string;
    submitter_username: string | null;
  }> | null;
  error: string | null;
}> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { data: null, error: authError ?? "Auth failed" };

  const { data, error } = await supabase
    .from("topic_suggestions")
    .select("id, title, description, categories, vote_count, status, expires_at, created_at, user_id")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  // Fetch submitter usernames
  const userIds = [...new Set((data ?? []).map((s) => s.user_id))];
  let usernameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    (profiles ?? []).forEach((p) => {
      usernameMap[p.id] = p.username;
    });
  }

  const rows = (data ?? []).map((s) => ({
    ...s,
    submitter_username: usernameMap[s.user_id] ?? null,
  }));

  return { data: rows, error: null };
}

export async function updateSuggestionStatus(
  id: string,
  status: "approved" | "rejected"
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  const { error } = await supabase
    .from("topic_suggestions")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

export async function deleteSuggestion(
  id: string
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  const { error } = await supabase
    .from("topic_suggestions")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

export async function deleteSubjects(
  ids: string[]
): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  // Collect hot_takes that reference these subjects, then clean up their votes
  const { data: relatedHotTakes } = await supabase
    .from("hot_takes")
    .select("id")
    .in("subject_id", ids);
  const hotTakeIds = (relatedHotTakes ?? []).map((h) => h.id);
  if (hotTakeIds.length > 0) {
    await supabase.from("hot_take_votes").delete().in("hot_take_id", hotTakeIds);
    const { error } = await supabase.from("hot_takes").delete().in("id", hotTakeIds);
    if (error) return { error: error.message };
  }

  const { error: scoresErr } = await supabase.from("user_subject_scores").delete().in("subject_id", ids);
  if (scoresErr) return { error: scoresErr.message };

  const { error: listsErr } = await supabase.from("user_lists").delete().in("subject_id", ids);
  if (listsErr) return { error: listsErr.message };

  const { error } = await supabase.from("subjects").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

export async function deleteAttributes(
  ids: string[]
): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  // Collect hot_takes that reference these attributes, then clean up their votes
  const { data: relatedHotTakes } = await supabase
    .from("hot_takes")
    .select("id")
    .in("attribute_id", ids);
  const hotTakeIds = (relatedHotTakes ?? []).map((h) => h.id);
  if (hotTakeIds.length > 0) {
    await supabase.from("hot_take_votes").delete().in("hot_take_id", hotTakeIds);
    const { error } = await supabase.from("hot_takes").delete().in("id", hotTakeIds);
    if (error) return { error: error.message };
  }

  const { error: ranksErr } = await supabase.from("user_attribute_ranks").delete().in("attribute_id", ids);
  if (ranksErr) return { error: ranksErr.message };

  const { error: scoresErr } = await supabase.from("user_subject_scores").delete().in("attribute_id", ids);
  if (scoresErr) return { error: scoresErr.message };

  const { error } = await supabase.from("attributes").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

export async function deleteTopic(
  id: string
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  // Delete related data in dependency order (all have topic_id)
  const relatedTables = [
    "user_attribute_ranks",
    "user_subject_scores",
    "user_lists",
    "attributes",
    "subjects",
  ] as const;

  for (const table of relatedTables) {
    const { error } = await supabase.from(table).delete().eq("topic_id", id);
    if (error) return { error: `Failed to delete from ${table}: ${error.message}` };
  }

  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}
