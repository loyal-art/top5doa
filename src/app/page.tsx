import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, slug, category, description, cover_image_url")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">
          Top5<span className="text-neutral-500">DOA</span>
        </h1>
        <p className="text-neutral-400 mt-3 max-w-lg mx-auto">
          Debate the greatest of all time across any category.
          Rank attributes, score subjects, and see how your list stacks up.
        </p>
      </div>

      {topics && topics.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="group block p-6 rounded-xl border border-neutral-800 bg-neutral-900
                         hover:border-neutral-600 hover:bg-neutral-800/50 transition-all"
            >
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                {topic.category}
              </p>
              <h2 className="text-lg font-bold group-hover:text-white transition-colors">
                {topic.title}
              </h2>
              {topic.description && (
                <p className="text-sm text-neutral-500 mt-2 line-clamp-2">
                  {topic.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-neutral-500">
          <p className="text-lg">No active topics yet.</p>
          <p className="text-sm mt-2">Check back soon — debates are coming.</p>
        </div>
      )}
    </main>
  );
}
