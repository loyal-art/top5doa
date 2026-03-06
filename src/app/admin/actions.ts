"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  const category = formData.get("category") as string;
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
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Fan-out notifications to premium users who subscribed to this category.
  // Non-blocking — topic creation succeeds even if the RPC fails.
  if (newTopic) {
    await supabase.rpc("notify_new_topic", {
      p_topic_id: newTopic.id,
      p_category: category,
      p_title: title,
    });
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
  }> | null;
  error: string | null;
}> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { data: null, error: authError ?? "Auth failed" };

  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, description, era, link_photo, link_music, link_video")
    .eq("topic_id", topic_id)
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
    category: string;
    status: string;
  }> | null;
  error: string | null;
}> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { data: null, error: authError ?? "Auth failed" };

  const { data, error } = await supabase
    .from("topics")
    .select("id, title, description, category, status")
    .order("title");

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function updateTopic(
  id: string,
  updates: {
    title: string;
    description: string | null;
    category: string;
    status: "draft" | "coming_soon" | "active" | "archived";
    cover_image_url: string | null;
  }
): Promise<{ error: string | null }> {
  const { supabase, error: authError } = await getAdminUser();
  if (authError || !supabase) return { error: authError ?? "Auth failed" };

  const { error } = await supabase.from("topics").update(updates).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}
