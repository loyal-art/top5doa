"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTopic, addSubject, addAttribute } from "./actions";

interface Topic {
  id: string;
  title: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-brand-surface border border-brand-border text-white font-body placeholder-neutral-700 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/30 transition-colors";

const labelClass =
  "block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1.5";

function StatusMessage({
  message,
}: {
  message: { type: "success" | "error"; text: string } | null;
}) {
  if (!message) return null;
  return (
    <p
      className={`text-sm font-mono ${message.type === "error" ? "text-brand-red" : "text-brand-accent"}`}
    >
      {message.text}
    </p>
  );
}

function CreateTopicForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setTitle(val);
    setSlug(slugify(val));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await createTopic(formData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Topic created!" });
      (e.target as HTMLFormElement).reset();
      setTitle("");
      setSlug("");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <section className="border border-brand-border rounded-2xl p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">CREATE TOPIC</h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className={labelClass}>Title</label>
          <input
            name="title"
            type="text"
            required
            value={title}
            onChange={handleTitleChange}
            className={inputClass}
            placeholder="Greatest NBA Player of All Time"
          />
        </div>
        <div>
          <label className={labelClass}>Slug</label>
          <input
            name="slug"
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
            placeholder="greatest-nba-player"
          />
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select name="category" required className={inputClass}>
            <option value="Sports">Sports</option>
            <option value="Music">Music</option>
            <option value="Film">Film</option>
            <option value="Gaming">Gaming</option>
            <option value="Fashion">Fashion</option>
            <option value="TV">TV</option>
            <option value="Food">Food</option>
            <option value="Culture">Culture</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Description (optional)</label>
          <textarea
            name="description"
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Who is the greatest NBA player of all time?"
          />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select name="status" className={inputClass}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <StatusMessage message={message} />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Creating..." : "Create Topic"}
        </button>
      </form>
    </section>
  );
}

function AddSubjectForm({ topics }: { topics: Topic[] }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await addSubject(formData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Subject added!" });
      (e.target as HTMLFormElement).reset();
    }
    setLoading(false);
  }

  return (
    <section className="border border-brand-border rounded-2xl p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">ADD SUBJECT</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body">
          No topics yet. Create a topic first.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className={labelClass}>Topic</label>
            <select name="topic_id" required className={inputClass}>
              <option value="">Select a topic...</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Name</label>
            <input
              name="name"
              type="text"
              required
              className={inputClass}
              placeholder="Michael Jordan"
            />
          </div>
          <div>
            <label className={labelClass}>Era (optional)</label>
            <input
              name="era"
              type="text"
              className={inputClass}
              placeholder="1984–2003"
            />
          </div>
          <div>
            <label className={labelClass}>Photo Link (optional)</label>
            <input
              name="link_photo"
              type="url"
              className={inputClass}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className={labelClass}>Music Link (optional)</label>
            <input
              name="link_music"
              type="url"
              className={inputClass}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className={labelClass}>Video Link (optional)</label>
            <input
              name="link_video"
              type="url"
              className={inputClass}
              placeholder="https://..."
            />
          </div>
          <StatusMessage message={message} />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Adding..." : "Add Subject"}
          </button>
        </form>
      )}
    </section>
  );
}

function AddAttributeForm({ topics }: { topics: Topic[] }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await addAttribute(formData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Attribute added!" });
      (e.target as HTMLFormElement).reset();
    }
    setLoading(false);
  }

  return (
    <section className="border border-brand-border rounded-2xl p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">ADD ATTRIBUTE</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body">
          No topics yet. Create a topic first.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className={labelClass}>Topic</label>
            <select name="topic_id" required className={inputClass}>
              <option value="">Select a topic...</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Name</label>
            <input
              name="name"
              type="text"
              required
              className={inputClass}
              placeholder="Scoring"
            />
          </div>
          <div>
            <label className={labelClass}>Description (optional)</label>
            <input
              name="description"
              type="text"
              className={inputClass}
              placeholder="Ability to score points efficiently"
            />
          </div>
          <StatusMessage message={message} />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Adding..." : "Add Attribute"}
          </button>
        </form>
      )}
    </section>
  );
}

export function AdminForms({ topics }: { topics: Topic[] }) {
  return (
    <div className="space-y-10">
      <CreateTopicForm />
      <AddSubjectForm topics={topics} />
      <AddAttributeForm topics={topics} />
    </div>
  );
}
