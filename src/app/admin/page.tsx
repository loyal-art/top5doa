import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminForms } from "./admin-forms";

export const metadata = { title: "Admin | Top5DOA" };

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-display text-4xl text-brand-red">ACCESS DENIED</h1>
          <p className="text-neutral-500 mt-2 font-body">
            Admin access required.
          </p>
        </div>
      </main>
    );
  }

  const { data: topics } = await supabase
    .from("topics")
    .select("id, title")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        <div className="mb-6 md:mb-8 border-b border-brand-border pb-4 md:pb-6">
          <h1 className="font-display text-4xl md:text-5xl tracking-wide">ADMIN PANEL</h1>
          <p className="text-neutral-500 mt-2 font-mono text-sm">
            Manage topics, subjects, and attributes.
          </p>
        </div>
        <AdminForms topics={topics ?? []} isAdmin={true} />
      </div>
    </main>
  );
}
