"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ViewCounter({ topicId }: { topicId: string }) {
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("increment_topic_view", { p_topic_id: topicId });
  }, [topicId]);

  return null;
}
