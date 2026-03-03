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
      status: status as "draft" | "pending" | "active" | "archived",
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

  const { error } = await supabase.from("subjects").insert({
    topic_id,
    name,
    era,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { error: null };
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
