"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createTopic,
  createTopicWithContent,
  addSubject,
  addAttribute,
  addSubjectsBulk,
  addAttributesBulk,
  getSubjectsForTopic,
  getAttributesForTopic,
  updateSubject,
  updateAttribute,
  getTopics,
  updateTopic,
  getTopicSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
  deleteTopic,
  deleteSubjects,
  deleteAttributes,
} from "./actions";

interface Topic {
  id: string;
  title: string;
}

type SubjectRow = {
  id: string;
  name: string;
  description: string | null;
  era: string | null;
  link_photo: string | null;
  link_music: string | null;
  link_video: string | null;
  video_url: string | null;
  sort_order: number;
};

type AttributeRow = {
  id: string;
  name: string;
  description: string | null;
};

type TopicRow = {
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
};

const ALL_CATEGORIES = [
  "NFL", "NBA", "MLB", "Music", "Movies", "Gaming",
  "Combat", "Culture", "Sports", "Film", "Fashion", "TV", "Food",
] as const;

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

// ── Section definitions ──────────────────────────────────────────────────────

type SectionId =
  | "ai-builder"
  | "create-topic"
  | "manage-topics"
  | "manage-subjects"
  | "manage-attributes"
  | "manage-suggestions"
  | "manage-archetypes";

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: "ai-builder", label: "AI Topic Builder", icon: "✦" },
  { id: "create-topic", label: "Create Topic", icon: "+" },
  { id: "manage-topics", label: "Manage Topics", icon: "◈" },
  { id: "manage-subjects", label: "Manage Subjects", icon: "◉" },
  { id: "manage-attributes", label: "Manage Attributes", icon: "◆" },
  { id: "manage-archetypes", label: "Archetypes", icon: "◎" },
  { id: "manage-suggestions", label: "Manage Suggestions", icon: "◇" },
];

// ── Draggable divider ────────────────────────────────────────────────────────

function ColumnDivider({
  onDrag,
}: {
  onDrag: (deltaX: number) => void;
}) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  // Use a ref so the mousemove handler always calls the latest onDrag
  const onDragRef = useRef(onDrag);
  useEffect(() => {
    onDragRef.current = onDrag;
  });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      onDragRef.current(delta);
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div
      onMouseDown={onMouseDown}
      className="hidden md:flex w-2 flex-shrink-0 items-stretch group"
      style={{ cursor: "col-resize" }}
    >
      <div className="w-full bg-brand-border/40 group-hover:bg-brand-accent/40 group-active:bg-brand-accent/60 transition-colors" />
    </div>
  );
}

// ── Form sections (column 2 — full form, no column 3) ───────────────────────

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
    <div className="p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">CREATE TOPIC</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className={labelClass}>Categories</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ALL_CATEGORIES.map((cat) => (
              <label key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-xs font-mono text-neutral-400 cursor-pointer hover:border-brand-accent/40 has-[:checked]:border-brand-accent has-[:checked]:text-brand-accent transition-colors">
                <input type="checkbox" name="category" value={cat} className="accent-[#e8ff00] w-3.5 h-3.5" />
                {cat}
              </label>
            ))}
          </div>
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
            <option value="coming_soon">Coming Soon</option>
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
    </div>
  );
}

function AddSubjectForm({ topics }: { topics: Topic[] }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{
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

  async function handleBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBulkLoading(true);
    setBulkMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await addSubjectsBulk(formData);

    if (result.error) {
      setBulkMessage({ type: "error", text: result.error });
    } else {
      setBulkMessage({
        type: "success",
        text: `Added ${result.count} subject${result.count === 1 ? "" : "s"}!`,
      });
      (e.target as HTMLFormElement).reset();
    }
    setBulkLoading(false);
  }

  return (
    <div className="p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">ADD SUBJECT</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body">
          No topics yet. Create a topic first.
        </p>
      ) : (
        <div className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
              Single Entry
            </p>
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

          <div className="border-t border-brand-border/50 pt-8">
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <p className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                Bulk Entry
              </p>
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
                <label className={labelClass}>Names (one per line)</label>
                <textarea
                  name="names"
                  required
                  rows={8}
                  className={`${inputClass} resize-y`}
                  placeholder={"Michael Jordan\nLeBron James\nKobe Bryant"}
                />
              </div>
              <StatusMessage message={bulkMessage} />
              <button
                type="submit"
                disabled={bulkLoading}
                className="px-6 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bulkLoading ? "Adding..." : "Add Subjects"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AddAttributeForm({ topics }: { topics: Topic[] }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{
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

  async function handleBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBulkLoading(true);
    setBulkMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await addAttributesBulk(formData);

    if (result.error) {
      setBulkMessage({
        type: "success",
        text: `Added ${result.count} attribute${result.count === 1 ? "" : "s"}!`,
      });
      (e.target as HTMLFormElement).reset();
    }
    setBulkLoading(false);
  }

  return (
    <div className="p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">ADD ATTRIBUTE</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body">
          No topics yet. Create a topic first.
        </p>
      ) : (
        <div className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
              Single Entry
            </p>
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

          <div className="border-t border-brand-border/50 pt-8">
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <p className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                Bulk Entry
              </p>
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
                <label className={labelClass}>Names (one per line)</label>
                <textarea
                  name="names"
                  required
                  rows={6}
                  className={`${inputClass} resize-y`}
                  placeholder={"Scoring\nDefense\nLeadership"}
                />
              </div>
              <StatusMessage message={bulkMessage} />
              <button
                type="submit"
                disabled={bulkLoading}
                className="px-6 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bulkLoading ? "Adding..." : "Add Attributes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit forms (rendered in column 3) ────────────────────────────────────────

function EditSubjectForm({
  subject,
  onSave,
  onCancel,
}: {
  subject: SubjectRow;
  onSave: (updated: SubjectRow) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState({
    name: subject.name,
    description: subject.description ?? "",
    era: subject.era ?? "",
    link_photo: subject.link_photo ?? "",
    link_music: subject.link_music ?? "",
    link_video: subject.link_video ?? "",
    video_url: subject.video_url ?? "",
    sort_order: subject.sort_order ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await updateSubject(subject.id, {
      name: fields.name,
      description: fields.description || null,
      era: fields.era || null,
      link_photo: fields.link_photo || null,
      link_music: fields.link_music || null,
      link_video: fields.link_video || null,
      video_url: fields.video_url || null,
      sort_order: fields.sort_order,
    });

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      setLoading(false);
    } else {
      onSave({
        ...subject,
        name: fields.name,
        description: fields.description || null,
        era: fields.era || null,
        link_photo: fields.link_photo || null,
        link_music: fields.link_music || null,
        link_video: fields.link_video || null,
        video_url: fields.video_url || null,
        sort_order: fields.sort_order,
      });
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl tracking-wide">EDIT SUBJECT</h2>
        <button
          type="button"
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
        >
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            required
            value={fields.name}
            onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Sort Order</label>
          <input
            type="number"
            value={fields.sort_order}
            onChange={(e) => setFields((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
            className={inputClass}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelClass}>Era</label>
          <input
            type="text"
            value={fields.era}
            onChange={(e) => setFields((f) => ({ ...f, era: e.target.value }))}
            className={inputClass}
            placeholder="1984–2003"
          />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={2}
            value={fields.description}
            onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
            className={`${inputClass} resize-none`}
            placeholder="Short description..."
          />
        </div>
        <div>
          <label className={labelClass}>Photo Link</label>
          <input
            type="url"
            value={fields.link_photo}
            onChange={(e) => setFields((f) => ({ ...f, link_photo: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className={labelClass}>Music Link</label>
          <input
            type="url"
            value={fields.link_music}
            onChange={(e) => setFields((f) => ({ ...f, link_music: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className={labelClass}>Video Link</label>
          <input
            type="url"
            value={fields.link_video}
            onChange={(e) => setFields((f) => ({ ...f, link_video: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className={labelClass}>Video URL</label>
          <input
            type="url"
            value={fields.video_url}
            onChange={(e) => setFields((f) => ({ ...f, video_url: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <StatusMessage message={message} />
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono text-sm font-bold hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-brand-border text-neutral-400 font-mono text-sm hover:text-white hover:border-neutral-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function EditAttributeForm({
  attribute,
  onSave,
  onCancel,
}: {
  attribute: AttributeRow;
  onSave: (updated: AttributeRow) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState({
    name: attribute.name,
    description: attribute.description ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await updateAttribute(attribute.id, {
      name: fields.name,
      description: fields.description || null,
    });

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      setLoading(false);
    } else {
      onSave({
        ...attribute,
        name: fields.name,
        description: fields.description || null,
      });
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl tracking-wide">EDIT ATTRIBUTE</h2>
        <button
          type="button"
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
        >
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            required
            value={fields.name}
            onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <input
            type="text"
            value={fields.description}
            onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
            className={inputClass}
            placeholder="Ability to score points efficiently"
          />
        </div>
        <StatusMessage message={message} />
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono text-sm font-bold hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-brand-border text-neutral-400 font-mono text-sm hover:text-white hover:border-neutral-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function EditTopicForm({
  topic,
  onSave,
  onCancel,
  onDelete,
}: {
  topic: TopicRow;
  onSave: (updated: TopicRow) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [fields, setFields] = useState({
    title: topic.title,
    description: topic.description ?? "",
    category: topic.category,
    status: topic.status,
    cover_image_url: topic.cover_image_url ?? "",
    card_image_url: topic.card_image_url ?? "",
    card_video_url: topic.card_video_url ?? "",
    video_url: topic.video_url ?? "",
    is_featured: topic.is_featured,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteConfirm() {
    if (deleteConfirmText !== "DELETE") return;
    setDeleteLoading(true);
    setDeleteError(null);
    const result = await deleteTopic(topic.id);
    if (result.error) {
      setDeleteError(result.error);
      setDeleteLoading(false);
    } else {
      onDelete();
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await updateTopic(topic.id, {
      title: fields.title,
      description: fields.description || null,
      category: fields.category,
      status: fields.status as "draft" | "coming_soon" | "active" | "archived",
      cover_image_url: fields.cover_image_url || null,
      card_image_url: fields.card_image_url || null,
      card_video_url: fields.card_video_url || null,
      video_url: fields.video_url || null,
      is_featured: fields.is_featured,
    });

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      setLoading(false);
    } else {
      onSave({
        ...topic,
        title: fields.title,
        description: fields.description || null,
        category: fields.category,
        status: fields.status,
        cover_image_url: fields.cover_image_url || null,
        card_image_url: fields.card_image_url || null,
        card_video_url: fields.card_video_url || null,
        video_url: fields.video_url || null,
        is_featured: fields.is_featured,
      });
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl tracking-wide">EDIT TOPIC</h2>
        <button
          type="button"
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
        >
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Title</label>
          <input
            type="text"
            required
            value={fields.title}
            onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Categories</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ALL_CATEGORIES.map((cat) => (
              <label key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-xs font-mono text-neutral-400 cursor-pointer hover:border-brand-accent/40 has-[:checked]:border-brand-accent has-[:checked]:text-brand-accent transition-colors">
                <input
                  type="checkbox"
                  checked={fields.category.includes(cat)}
                  onChange={(e) => {
                    setFields((f) => ({
                      ...f,
                      category: e.target.checked
                        ? [...f.category, cat]
                        : f.category.filter((c) => c !== cat),
                    }));
                  }}
                  className="accent-[#e8ff00] w-3.5 h-3.5"
                />
                {cat}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={2}
            value={fields.description}
            onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
            className={`${inputClass} resize-none`}
            placeholder="Short description..."
          />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={fields.status}
            onChange={(e) => setFields((f) => ({ ...f, status: e.target.value }))}
            className={inputClass}
          >
            <option value="draft">Draft</option>
            <option value="coming_soon">Coming Soon</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-xs font-mono text-neutral-400 cursor-pointer hover:border-brand-accent/40 has-[:checked]:border-brand-accent has-[:checked]:text-brand-accent transition-colors">
            <input
              type="checkbox"
              checked={fields.is_featured}
              onChange={(e) => setFields((f) => ({ ...f, is_featured: e.target.checked }))}
              className="accent-[#e8ff00] w-3.5 h-3.5"
            />
            Featured (shown in hero banner)
          </label>
        </div>
        <div>
          <label className={labelClass}>Cover Image URL</label>
          <input
            type="url"
            value={fields.cover_image_url}
            onChange={(e) => setFields((f) => ({ ...f, cover_image_url: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className={labelClass}>Card Image URL</label>
          <input
            type="url"
            value={fields.card_image_url}
            onChange={(e) => setFields((f) => ({ ...f, card_image_url: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className={labelClass}>Card Video URL</label>
          <input
            type="url"
            value={fields.card_video_url}
            onChange={(e) => setFields((f) => ({ ...f, card_video_url: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className={labelClass}>Video URL</label>
          <input
            type="url"
            value={fields.video_url}
            onChange={(e) => setFields((f) => ({ ...f, video_url: e.target.value }))}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <StatusMessage message={message} />
        <div className="flex gap-2 pt-2 flex-wrap">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono text-sm font-bold hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-brand-border text-neutral-400 font-mono text-sm hover:text-white hover:border-neutral-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="px-5 py-2.5 rounded-xl border border-red-700/60 text-red-400 font-mono text-sm hover:bg-red-900/30 hover:text-red-300 hover:border-red-500 transition-colors ml-auto"
          >
            Delete Topic
          </button>
        </div>
      </form>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-neutral-900 border border-red-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-display text-lg text-red-400 mb-2 tracking-wide">DELETE TOPIC</h3>
            <p className="text-sm text-neutral-400 font-mono mb-1 leading-relaxed">
              This will permanently delete &ldquo;{topic.title}&rdquo; and all related subjects, attributes, rankings, scores, and user lists.
            </p>
            <p className="text-sm text-neutral-300 font-mono mb-4">
              Type <span className="text-red-400 font-bold">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDeleteConfirm(); }}
              placeholder="DELETE"
              className={inputClass}
              autoFocus
            />
            {deleteError && (
              <p className="text-sm font-mono text-red-400 mt-2">{deleteError}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                className="px-5 py-2.5 rounded-xl bg-red-700 text-white font-mono text-sm font-bold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? "Deleting..." : "Delete Topic"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmText("");
                  setDeleteError(null);
                }}
                className="px-5 py-2.5 rounded-xl border border-brand-border text-neutral-400 font-mono text-sm hover:text-white hover:border-neutral-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── List panels (column 2 for list-based sections) ───────────────────────────

function TopicsList({
  onSelect,
  selectedId,
  deletedId,
}: {
  onSelect: (topic: TopicRow) => void;
  selectedId: string | null;
  deletedId: string | null;
}) {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      const result = await getTopics();
      if (result.error) {
        setLoadError(result.error);
      } else {
        setTopics(result.data ?? []);
      }
      setLoading(false);
    })();
  }, []);

  // Remove deleted topic from local state
  useEffect(() => {
    if (deletedId) {
      setTopics((prev) => prev.filter((t) => t.id !== deletedId));
    }
  }, [deletedId]);

  // Expose updated topic back to parent after save
  const handleSaved = useCallback(
    (updated: TopicRow) => {
      setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      onSelect(updated);
    },
    [onSelect],
  );

  return (
    <TopicsListInner
      topics={topics}
      loading={loading}
      loadError={loadError}
      selectedId={selectedId}
      onSelect={onSelect}
      onSaved={handleSaved}
    />
  );
}

function TopicsListInner({
  topics,
  loading,
  loadError,
  selectedId,
  onSelect,
}: {
  topics: TopicRow[];
  loading: boolean;
  loadError: string | null;
  selectedId: string | null;
  onSelect: (topic: TopicRow) => void;
  onSaved: (updated: TopicRow) => void;
}) {
  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="font-display text-lg tracking-wide mb-4 px-2">TOPICS</h2>
      {loading && <p className="text-sm font-mono text-neutral-500 px-2">Loading...</p>}
      {loadError && <p className="text-sm font-mono text-brand-red px-2">{loadError}</p>}
      {!loading && !loadError && topics.length === 0 && (
        <p className="text-neutral-500 font-body text-sm px-2">No topics yet.</p>
      )}
      <ul className="space-y-0.5">
        {topics.map((topic) => (
          <li key={topic.id}>
            <button
              type="button"
              onClick={() => onSelect(topic)}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-body text-sm transition-colors ${
                selectedId === topic.id
                  ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/30"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white border border-transparent"
              }`}
            >
              <div className="truncate">{topic.title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-neutral-600">{topic.status}</span>
                {topic.category.length > 0 && (
                  <span className="text-xs font-mono text-neutral-600 truncate">{topic.category.join(", ")}</span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type MusicLinkResult = {
  id: string;
  name: string;
  deezerUrl: string | null;
  deezerEmbedUrl: string | null;
  spotifySearchUrl: string | null;
  previewUrl: string | null;
  trackTitle: string | null;
  artistName: string | null;
  saveChoice: "deezer" | "spotify";
  checked: boolean;
};

function SubjectsList({
  topics,
  onSelect,
  selectedId,
  onDeleted,
}: {
  topics: Topic[];
  onSelect: (subject: SubjectRow) => void;
  selectedId: string | null;
  onDeleted: (deletedIds: string[]) => void;
}) {
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Bulk-delete state
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allChecked = subjects.length > 0 && checkedIds.size === subjects.length;
  const someChecked = checkedIds.size > 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked && !allChecked;
    }
  }, [someChecked, allChecked]);

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set(subjects.map((s) => s.id)));
  }

  async function handleDeleteSelected() {
    if (deleteConfirmText !== "DELETE") return;
    setDeleteLoading(true);
    const ids: string[] = Array.from(checkedIds);
    const result = await deleteSubjects(ids);
    setDeleteLoading(false);
    if (result.error) {
      setDeleteMsg({ type: "error", text: result.error });
    } else {
      setDeleteMsg({ type: "success", text: `Deleted ${ids.length} subject${ids.length === 1 ? "" : "s"}.` });
      setSubjects((prev) => prev.filter((s) => !checkedIds.has(s.id)));
      setCheckedIds(new Set());
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
      onDeleted(ids);
    }
  }

  // Sort order state
  const [autoNumberLoading, setAutoNumberLoading] = useState(false);

  async function handleAutoNumber() {
    if (subjects.length === 0) return;
    setAutoNumberLoading(true);
    let errCount = 0;
    const updated = subjects.map((s, i) => ({ ...s, sort_order: i + 1 }));
    for (const s of updated) {
      const result = await updateSubject(s.id, {
        name: s.name,
        description: s.description,
        era: s.era,
        link_photo: s.link_photo,
        link_music: s.link_music,
        link_video: s.link_video,
        video_url: s.video_url,
        sort_order: s.sort_order,
      });
      if (result.error) errCount++;
    }
    setSubjects(updated);
    setAutoNumberLoading(false);
    if (errCount > 0) {
      setListError(`Auto-number: ${errCount} failed to save`);
    }
  }

  async function handleSortOrderBlur(subjectId: string, newOrder: number) {
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject || subject.sort_order === newOrder) return;
    await updateSubject(subjectId, {
      name: subject.name,
      description: subject.description,
      era: subject.era,
      link_photo: subject.link_photo,
      link_music: subject.link_music,
      link_video: subject.link_video,
      video_url: subject.video_url,
      sort_order: newOrder,
    });
    setSubjects((prev) => prev.map((s) => s.id === subjectId ? { ...s, sort_order: newOrder } : s));
  }

  // Music link finder state
  const [musicResults, setMusicResults] = useState<MusicLinkResult[] | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [savingMusic, setSavingMusic] = useState(false);
  const [musicSaveMsg, setMusicSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadSubjects(topicId: string) {
    setLoadingList(true);
    setListError(null);
    setMusicResults(null);
    setMusicError(null);
    setMusicSaveMsg(null);
    const result = await getSubjectsForTopic(topicId);
    if (result.error) {
      setListError(result.error);
    } else {
      setSubjects(result.data ?? []);
    }
    setLoadingList(false);
  }

  function handleTopicChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedTopicId(id);
    setSubjects([]);
    setCheckedIds(new Set());
    setDeleteMsg(null);
    setMusicResults(null);
    setMusicError(null);
    setMusicSaveMsg(null);
    if (id) loadSubjects(id);
  }

  const selectedTopicTitle = topics.find((t) => t.id === selectedTopicId)?.title ?? "";

  async function handleFindMusic() {
    if (!selectedTopicId || subjects.length === 0) return;
    setMusicLoading(true);
    setMusicError(null);
    setMusicResults(null);
    setMusicSaveMsg(null);

    try {
      const res = await fetch("/api/ai/find-music-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicTitle: selectedTopicTitle,
          subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMusicError(data.error ?? `Request failed (${res.status})`);
        setMusicLoading(false);
        return;
      }

      const data = await res.json();
      const links: {
        id: string;
        name: string;
        deezerUrl: string | null;
        deezerEmbedUrl: string | null;
        spotifySearchUrl: string | null;
        previewUrl: string | null;
        trackTitle: string | null;
        artistName: string | null;
      }[] = data.links ?? [];
      setMusicResults(
        links.map((l) => ({
          ...l,
          saveChoice: "deezer" as const,
          checked: l.deezerUrl !== null,
        })),
      );
    } catch {
      setMusicError("Network error — check your connection and try again.");
    }
    setMusicLoading(false);
  }

  function toggleMusicResult(id: string) {
    setMusicResults((prev) =>
      prev?.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)) ?? null,
    );
  }

  function setSaveChoice(id: string, choice: "spotify" | "deezer") {
    setMusicResults((prev) =>
      prev?.map((r) => (r.id === id ? { ...r, saveChoice: choice } : r)) ?? null,
    );
  }

  async function handleSaveMusicLinks() {
    if (!musicResults) return;
    const toSave = musicResults.filter((r) => r.checked && (r.deezerUrl || r.spotifySearchUrl));
    if (toSave.length === 0) return;

    setSavingMusic(true);
    setMusicSaveMsg(null);

    let saved = 0;
    let errored = 0;
    for (const item of toSave) {
      const subject = subjects.find((s) => s.id === item.id);
      if (!subject) continue;
      const url = item.saveChoice === "deezer" ? item.deezerEmbedUrl : item.spotifySearchUrl;
      if (!url) continue;
      const result = await updateSubject(item.id, {
        name: subject.name,
        description: subject.description,
        era: subject.era,
        link_photo: subject.link_photo,
        link_music: url,
        link_video: subject.link_video,
        video_url: subject.video_url,
        sort_order: subject.sort_order,
      });
      if (result.error) {
        errored++;
      } else {
        saved++;
      }
    }

    if (errored > 0) {
      setMusicSaveMsg({ type: "error", text: `Saved ${saved}, failed ${errored}.` });
    } else {
      setMusicSaveMsg({ type: "success", text: `Updated music links for ${saved} subject${saved === 1 ? "" : "s"}.` });
    }
    setSavingMusic(false);
    // Reload subjects to reflect updates
    if (selectedTopicId) loadSubjects(selectedTopicId);
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="font-display text-lg tracking-wide mb-4 px-2">SUBJECTS</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body text-sm px-2">No topics yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="px-2">
            <select
              value={selectedTopicId}
              onChange={handleTopicChange}
              className={inputClass}
            >
              <option value="">Select a topic...</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </div>

          {loadingList && (
            <p className="text-sm font-mono text-neutral-500 px-2">Loading...</p>
          )}
          {listError && (
            <p className="text-sm font-mono text-brand-red px-2">{listError}</p>
          )}
          {!loadingList && selectedTopicId && subjects.length === 0 && !listError && (
            <p className="text-sm font-mono text-neutral-500 px-2">No subjects found.</p>
          )}

          {/* Find Music Links button */}
          {!loadingList && subjects.length > 0 && !musicResults && (
            <div className="px-2">
              <button
                type="button"
                onClick={handleFindMusic}
                disabled={musicLoading}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-green-500/40 text-green-400 font-mono text-xs hover:bg-green-500/10 hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {musicLoading ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Searching music/video links...
                  </>
                ) : (
                  <>
                    <span>&#9835;</span>
                    Find Music/Video Links
                  </>
                )}
              </button>
            </div>
          )}
          {musicError && (
            <p className="text-sm font-mono text-brand-red px-2">{musicError}</p>
          )}

          {/* Music link results review */}
          {musicResults && (
            <div className="px-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                  Music Links Found
                </span>
                <button
                  type="button"
                  onClick={() => { setMusicResults(null); setMusicSaveMsg(null); }}
                  className="text-xs font-mono text-neutral-500 hover:text-white transition-colors"
                >
                  Dismiss
                </button>
              </div>
              <ul className="space-y-1.5">
                {musicResults.map((r) => (
                  <li
                    key={r.id}
                    className="px-2.5 py-2.5 rounded-lg border border-brand-border bg-brand-surface text-sm"
                  >
                    <div className="flex items-start gap-2">
                      {r.deezerUrl ? (
                        <input
                          type="checkbox"
                          checked={r.checked}
                          onChange={() => toggleMusicResult(r.id)}
                          className="accent-[#e8ff00] w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                        />
                      ) : (
                        <span className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-body text-white text-sm truncate">{r.name}</div>
                        {r.trackTitle ? (
                          <div className="text-xs font-mono text-neutral-400 mt-0.5">
                            {r.trackTitle} — {r.artistName}
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-neutral-600">No match found</span>
                        )}
                        {r.deezerUrl && (
                          <div className="flex flex-col gap-1 mt-1.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`save-choice-${r.id}`}
                                checked={r.saveChoice === "deezer"}
                                onChange={() => setSaveChoice(r.id, "deezer")}
                                className="accent-[#A238FF] w-3 h-3 flex-shrink-0"
                              />
                              <a
                                href={r.deezerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-purple-400 hover:text-purple-300 truncate"
                              >
                                Deezer Embed (default)
                              </a>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`save-choice-${r.id}`}
                                checked={r.saveChoice === "spotify"}
                                onChange={() => setSaveChoice(r.id, "spotify")}
                                className="accent-[#1DB954] w-3 h-3 flex-shrink-0"
                              />
                              <a
                                href={r.spotifySearchUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-green-400 hover:text-green-300 truncate"
                              >
                                Spotify Search
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <StatusMessage message={musicSaveMsg} />
              <button
                type="button"
                onClick={handleSaveMusicLinks}
                disabled={savingMusic || musicResults.filter((r) => r.checked && r.deezerUrl).length === 0}
                className="w-full px-3 py-2 rounded-lg bg-brand-accent text-brand-bg font-mono text-xs font-bold hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingMusic
                  ? "Saving..."
                  : `Save Selected Links (${musicResults.filter((r) => r.checked && r.deezerUrl).length})`}
              </button>
            </div>
          )}

          {/* Bulk-delete toolbar */}
          {subjects.length > 0 && (
            <div className="px-2 space-y-1.5">
              {someChecked && (
                <button
                  type="button"
                  onClick={() => { setShowDeleteDialog(true); setDeleteConfirmText(""); setDeleteMsg(null); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-red-700/60 text-red-400 font-mono text-xs hover:bg-red-900/20 hover:border-red-500 transition-colors"
                >
                  Delete Selected ({checkedIds.size})
                </button>
              )}
              {deleteMsg && (
                <p className={`text-xs font-mono px-1 ${deleteMsg.type === "error" ? "text-red-400" : "text-brand-accent"}`}>
                  {deleteMsg.text}
                </p>
              )}
            </div>
          )}

          {/* Auto-number + Subject list with checkboxes */}
          {subjects.length > 0 && (
            <div className="space-y-1">
            <div className="flex items-center justify-between px-3">
              <button
                type="button"
                onClick={handleAutoNumber}
                disabled={autoNumberLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-brand-accent/40 text-brand-accent font-mono text-[10px] tracking-wider hover:bg-brand-accent/10 hover:border-brand-accent disabled:opacity-50 transition-colors"
              >
                {autoNumberLoading ? "Saving..." : "Auto-number"}
              </button>
              <span className="text-[10px] font-mono text-neutral-600">#</span>
            </div>
            <ul className="space-y-0.5">
              <li className="flex items-center gap-2 px-3 py-1">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="accent-[#e8ff00] w-3.5 h-3.5 flex-shrink-0"
                />
                <span className="text-xs font-mono text-neutral-500 select-none">Select All</span>
              </li>
              {subjects.map((subject) => (
                <li key={subject.id} className="flex items-center gap-1.5 px-2">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(subject.id)}
                    onChange={() => toggleCheck(subject.id)}
                    className="accent-[#e8ff00] w-3.5 h-3.5 flex-shrink-0 ml-0.5"
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(subject)}
                    className={`flex-1 min-w-0 text-left px-2 py-2 rounded-lg font-body text-sm transition-colors ${
                      selectedId === subject.id
                        ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/30"
                        : "text-neutral-300 hover:bg-neutral-800 hover:text-white border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{subject.name}</span>
                      {subject.link_music && (
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500" title="Has music link" />
                      )}
                    </div>
                    {subject.era && (
                      <span className="text-xs font-mono text-neutral-600">{subject.era}</span>
                    )}
                  </button>
                  <input
                    type="number"
                    defaultValue={subject.sort_order}
                    onBlur={(e) => handleSortOrderBlur(subject.id, parseInt(e.target.value) || 0)}
                    className="w-10 h-7 text-center text-xs font-mono bg-brand-surface border border-brand-border rounded text-neutral-400 focus:border-brand-accent focus:text-white outline-none flex-shrink-0"
                    title="Sort order"
                  />
                </li>
              ))}
            </ul>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-neutral-900 border border-red-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-display text-lg text-red-400 mb-2 tracking-wide">DELETE SUBJECTS</h3>
            <p className="text-sm text-neutral-400 font-mono mb-4 leading-relaxed">
              Permanently delete {checkedIds.size} subject{checkedIds.size === 1 ? "" : "s"} and all related scores, lists, and hot takes?{" "}
              Type <span className="text-red-400 font-bold">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDeleteSelected(); }}
              placeholder="DELETE"
              className={inputClass}
              autoFocus
            />
            {deleteMsg?.type === "error" && (
              <p className="text-sm font-mono text-red-400 mt-2">{deleteMsg.text}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                className="px-5 py-2.5 rounded-xl bg-red-700 text-white font-mono text-sm font-bold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? "Deleting..." : `Delete ${checkedIds.size}`}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteDialog(false); setDeleteConfirmText(""); }}
                className="px-5 py-2.5 rounded-xl border border-brand-border text-neutral-400 font-mono text-sm hover:text-white hover:border-neutral-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AttributesList({
  topics,
  onSelect,
  selectedId,
  onDeleted,
}: {
  topics: Topic[];
  onSelect: (attribute: AttributeRow) => void;
  selectedId: string | null;
  onDeleted: (deletedIds: string[]) => void;
}) {
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Bulk-delete state
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allChecked = attributes.length > 0 && checkedIds.size === attributes.length;
  const someChecked = checkedIds.size > 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked && !allChecked;
    }
  }, [someChecked, allChecked]);

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set(attributes.map((a) => a.id)));
  }

  async function handleDeleteSelected() {
    if (deleteConfirmText !== "DELETE") return;
    setDeleteLoading(true);
    const ids: string[] = Array.from(checkedIds);
    const result = await deleteAttributes(ids);
    setDeleteLoading(false);
    if (result.error) {
      setDeleteMsg({ type: "error", text: result.error });
    } else {
      setDeleteMsg({ type: "success", text: `Deleted ${ids.length} attribute${ids.length === 1 ? "" : "s"}.` });
      setAttributes((prev) => prev.filter((a) => !checkedIds.has(a.id)));
      setCheckedIds(new Set());
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
      onDeleted(ids);
    }
  }

  async function loadAttributes(topicId: string) {
    setLoadingList(true);
    setListError(null);
    const result = await getAttributesForTopic(topicId);
    if (result.error) {
      setListError(result.error);
    } else {
      setAttributes(result.data ?? []);
    }
    setLoadingList(false);
  }

  function handleTopicChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedTopicId(id);
    setAttributes([]);
    setCheckedIds(new Set());
    setDeleteMsg(null);
    if (id) loadAttributes(id);
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="font-display text-lg tracking-wide mb-4 px-2">ATTRIBUTES</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body text-sm px-2">No topics yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="px-2">
            <select
              value={selectedTopicId}
              onChange={handleTopicChange}
              className={inputClass}
            >
              <option value="">Select a topic...</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </div>

          {loadingList && (
            <p className="text-sm font-mono text-neutral-500 px-2">Loading...</p>
          )}
          {listError && (
            <p className="text-sm font-mono text-brand-red px-2">{listError}</p>
          )}
          {!loadingList && selectedTopicId && attributes.length === 0 && !listError && (
            <p className="text-sm font-mono text-neutral-500 px-2">No attributes found.</p>
          )}

          {/* Bulk-delete toolbar */}
          {attributes.length > 0 && (
            <div className="px-2 space-y-1.5">
              {someChecked && (
                <button
                  type="button"
                  onClick={() => { setShowDeleteDialog(true); setDeleteConfirmText(""); setDeleteMsg(null); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-red-700/60 text-red-400 font-mono text-xs hover:bg-red-900/20 hover:border-red-500 transition-colors"
                >
                  Delete Selected ({checkedIds.size})
                </button>
              )}
              {deleteMsg && (
                <p className={`text-xs font-mono px-1 ${deleteMsg.type === "error" ? "text-red-400" : "text-brand-accent"}`}>
                  {deleteMsg.text}
                </p>
              )}
            </div>
          )}

          {/* Attribute list with checkboxes */}
          {attributes.length > 0 && (
            <ul className="space-y-0.5">
              <li className="flex items-center gap-2 px-3 py-1">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="accent-[#e8ff00] w-3.5 h-3.5 flex-shrink-0"
                />
                <span className="text-xs font-mono text-neutral-500 select-none">Select All</span>
              </li>
              {attributes.map((attribute) => (
                <li key={attribute.id} className="flex items-center gap-1.5 px-2">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(attribute.id)}
                    onChange={() => toggleCheck(attribute.id)}
                    className="accent-[#e8ff00] w-3.5 h-3.5 flex-shrink-0 ml-0.5"
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(attribute)}
                    className={`flex-1 min-w-0 text-left px-2 py-2 rounded-lg font-body text-sm transition-colors ${
                      selectedId === attribute.id
                        ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/30"
                        : "text-neutral-300 hover:bg-neutral-800 hover:text-white border border-transparent"
                    }`}
                  >
                    <div className="break-words">{attribute.name}</div>
                    {attribute.description && (
                      <span className="text-xs font-mono text-neutral-600 break-words block whitespace-normal">{attribute.description}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-neutral-900 border border-red-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-display text-lg text-red-400 mb-2 tracking-wide">DELETE ATTRIBUTES</h3>
            <p className="text-sm text-neutral-400 font-mono mb-4 leading-relaxed">
              Permanently delete {checkedIds.size} attribute{checkedIds.size === 1 ? "" : "s"} and all related rankings, scores, and hot takes?{" "}
              Type <span className="text-red-400 font-bold">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDeleteSelected(); }}
              placeholder="DELETE"
              className={inputClass}
              autoFocus
            />
            {deleteMsg?.type === "error" && (
              <p className="text-sm font-mono text-red-400 mt-2">{deleteMsg.text}</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                className="px-5 py-2.5 rounded-xl bg-red-700 text-white font-mono text-sm font-bold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? "Deleting..." : `Delete ${checkedIds.size}`}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteDialog(false); setDeleteConfirmText(""); }}
                className="px-5 py-2.5 rounded-xl border border-brand-border text-neutral-400 font-mono text-sm hover:text-white hover:border-neutral-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suggestions list + detail ────────────────────────────────────────────────

type SuggestionRow = {
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
};

function SuggestionsList({
  onSelect,
  selectedId,
}: {
  onSelect: (suggestion: SuggestionRow) => void;
  selectedId: string | null;
}) {
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      const result = await getTopicSuggestions();
      if (result.error) {
        setLoadError(result.error);
      } else {
        setSuggestions(result.data ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const statusDot: Record<string, string> = {
    pending: "bg-yellow-400",
    approved: "bg-brand-accent",
    rejected: "bg-brand-red",
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="font-display text-lg tracking-wide mb-4 px-2">SUGGESTIONS</h2>
      {loading && <p className="text-sm font-mono text-neutral-500 px-2">Loading...</p>}
      {loadError && <p className="text-sm font-mono text-brand-red px-2">{loadError}</p>}
      {!loading && !loadError && suggestions.length === 0 && (
        <p className="text-neutral-500 font-body text-sm px-2">No suggestions yet.</p>
      )}
      <ul className="space-y-0.5">
        {suggestions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-body text-sm transition-colors ${
                selectedId === s.id
                  ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/30"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[s.status] ?? "bg-neutral-500"}`} />
                <span className="truncate">{s.title}</span>
              </div>
              <div className="text-xs font-mono text-neutral-600 mt-0.5 pl-4">
                {s.vote_count} vote{s.vote_count !== 1 ? "s" : ""} &middot; {s.status}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestionDetail({
  suggestion,
  onClose,
  onUpdate,
}: {
  suggestion: SuggestionRow;
  onClose: () => void;
  onUpdate: (updated: SuggestionRow | null) => void;
}) {
  const [actionLoading, setActionLoading] = useState(false);

  function daysRemaining(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  async function handleStatus(status: "approved" | "rejected") {
    setActionLoading(true);
    const result = await updateSuggestionStatus(suggestion.id, status);
    if (result.error) {
      alert(result.error);
    } else {
      onUpdate({ ...suggestion, status });
    }
    setActionLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this suggestion permanently?")) return;
    setActionLoading(true);
    const result = await deleteSuggestion(suggestion.id);
    if (result.error) {
      alert(result.error);
    } else {
      onUpdate(null);
    }
    setActionLoading(false);
  }

  const days = daysRemaining(suggestion.expires_at);

  const statusColor: Record<string, string> = {
    pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    approved: "text-brand-accent bg-brand-accent/10 border-brand-accent/30",
    rejected: "text-brand-red bg-brand-red/10 border-brand-red/30",
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl tracking-wide">SUGGESTION DETAIL</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="font-body text-white text-lg">{suggestion.title}</h3>
          {suggestion.description && (
            <p className="text-sm font-body text-neutral-400 mt-1">{suggestion.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-md border text-xs font-mono uppercase tracking-wider ${statusColor[suggestion.status] ?? "text-neutral-500 bg-neutral-500/10 border-neutral-500/30"}`}
          >
            {suggestion.status}
          </span>
        </div>

        <div className="space-y-1.5 text-xs font-mono text-neutral-500">
          <div>By <span className="text-neutral-300">{suggestion.submitter_username ?? "unknown"}</span></div>
          <div>{suggestion.vote_count} vote{suggestion.vote_count !== 1 ? "s" : ""}</div>
          <div>{suggestion.categories.join(", ")}</div>
          <div className={days <= 2 ? "text-brand-red" : ""}>
            {days > 0 ? `${days}d remaining` : "expired"}
          </div>
          <div>{formatDate(suggestion.created_at)}</div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-brand-border">
          {suggestion.status !== "approved" && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleStatus("approved")}
              className="px-4 py-2 rounded-lg border border-brand-accent/40 text-brand-accent font-mono text-xs hover:bg-brand-accent/10 hover:border-brand-accent transition-colors disabled:opacity-50"
            >
              Approve
            </button>
          )}
          {suggestion.status !== "rejected" && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleStatus("rejected")}
              className="px-4 py-2 rounded-lg border border-yellow-400/40 text-yellow-400 font-mono text-xs hover:bg-yellow-400/10 hover:border-yellow-400 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          )}
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg border border-brand-red/40 text-brand-red font-mono text-xs hover:bg-brand-red/10 hover:border-brand-red transition-colors disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Topic Builder ─────────────────────────────────────────────────────────

type AiSubject = { name: string; description: string; era: string | null };
type AiAttribute = { name: string; description: string };

function AiTopicBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<AiSubject[]>([]);
  const [attributes, setAttributes] = useState<AiAttribute[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function handleTitleChange(val: string) {
    setTitle(val);
    setSlug(slugify(val));
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleGenerate() {
    if (!title.trim()) return;
    setGenerating(true);
    setGenError(null);

    try {
      const res = await fetch("/api/ai/generate-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), categories }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGenError(data.error ?? `Request failed (${res.status})`);
        setGenerating(false);
        return;
      }

      const data = await res.json();
      setSubjects(
        (data.subjects ?? []).map((s: AiSubject) => ({
          name: s.name ?? "",
          description: s.description ?? "",
          era: s.era ?? null,
        }))
      );
      setAttributes(
        (data.attributes ?? []).map((a: AiAttribute) => ({
          name: a.name ?? "",
          description: a.description ?? "",
        }))
      );
      setHasGenerated(true);
    } catch {
      setGenError("Network error — check your connection and try again.");
    }
    setGenerating(false);
  }

  function updateSubjectField(idx: number, field: keyof AiSubject, value: string) {
    setSubjects((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value || (field === "era" ? null : "") } : s))
    );
  }
  function removeSubject(idx: number) {
    setSubjects((prev) => prev.filter((_, i) => i !== idx));
  }
  function addNewSubject() {
    setSubjects((prev) => [...prev, { name: "", description: "", era: null }]);
  }

  function updateAttributeField(idx: number, field: keyof AiAttribute, value: string) {
    setAttributes((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    );
  }
  function removeAttribute(idx: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== idx));
  }
  function addNewAttribute() {
    setAttributes((prev) => [...prev, { name: "", description: "" }]);
  }

  async function handleCreate() {
    if (!title.trim() || !slug.trim()) {
      setCreateMessage({ type: "error", text: "Title and slug are required." });
      return;
    }
    const validSubjects = subjects.filter((s) => s.name.trim());
    const validAttrs = attributes.filter((a) => a.name.trim());
    if (validSubjects.length === 0) {
      setCreateMessage({ type: "error", text: "At least one subject is required." });
      return;
    }

    setCreating(true);
    setCreateMessage(null);

    const result = await createTopicWithContent({
      title: title.trim(),
      slug: slug.trim(),
      category: categories,
      description: description.trim() || null,
      status,
      subjects: validSubjects.map((s) => ({
        name: s.name.trim(),
        description: s.description.trim() || null,
        era: s.era?.trim() || null,
      })),
      attributes: validAttrs.map((a) => ({
        name: a.name.trim(),
        description: a.description.trim() || null,
      })),
    });

    if (result.error) {
      setCreateMessage({ type: "error", text: result.error });
    } else {
      setCreateMessage({
        type: "success",
        text: `Topic created with ${validSubjects.length} subjects and ${validAttrs.length} attributes!`,
      });
      setTitle("");
      setSlug("");
      setCategories([]);
      setDescription("");
      setSubjects([]);
      setAttributes([]);
      setHasGenerated(false);
      router.refresh();
    }
    setCreating(false);
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-accent/10 border border-brand-accent/30 text-xs font-mono text-brand-accent">
          AI
        </span>
        <h2 className="font-display text-2xl tracking-wide">AI TOPIC BUILDER</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>Topic Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className={inputClass}
            placeholder="Top 5 Greatest Quarterbacks of All Time"
          />
        </div>

        <div>
          <label className={labelClass}>Slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
            placeholder="top-5-greatest-quarterbacks"
          />
        </div>

        <div>
          <label className={labelClass}>Categories</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ALL_CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-xs font-mono text-neutral-400 cursor-pointer hover:border-brand-accent/40 has-[:checked]:border-brand-accent has-[:checked]:text-brand-accent transition-colors"
              >
                <input
                  type="checkbox"
                  checked={categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="accent-[#e8ff00] w-3.5 h-3.5"
                />
                {cat}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="Who are the greatest quarterbacks to ever play the game?"
          />
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="coming_soon">Coming Soon</option>
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !title.trim()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-accent/20 border border-brand-accent/40 text-brand-accent font-mono font-bold hover:bg-brand-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            "Generate with AI"
          )}
        </button>

        {genError && (
          <p className="text-sm font-mono text-brand-red">{genError}</p>
        )}
      </div>

      {hasGenerated && (
        <div className="mt-8 space-y-6 border-t border-brand-border pt-6">
          <p className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
            Review &amp; Edit Generated Content
          </p>

          {/* Subjects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg tracking-wide">
                SUBJECTS ({subjects.length})
              </h3>
              <button
                type="button"
                onClick={addNewSubject}
                className="px-3 py-1.5 rounded-lg border border-brand-border text-neutral-400 font-mono text-xs hover:text-brand-accent hover:border-brand-accent/40 transition-colors"
              >
                + Add Subject
              </button>
            </div>
            <div className="space-y-2">
              {subjects.map((s, i) => (
                <div
                  key={i}
                  className="flex gap-2 items-start p-3 rounded-xl border border-brand-border bg-brand-surface"
                >
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => updateSubjectField(i, "name", e.target.value)}
                        className={inputClass}
                        placeholder="Name"
                      />
                      <input
                        type="text"
                        value={s.era ?? ""}
                        onChange={(e) => updateSubjectField(i, "era", e.target.value)}
                        className={`${inputClass} w-32`}
                        placeholder="Era"
                      />
                    </div>
                    <input
                      type="text"
                      value={s.description}
                      onChange={(e) => updateSubjectField(i, "description", e.target.value)}
                      className={inputClass}
                      placeholder="Description"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSubject(i)}
                    className="flex-shrink-0 mt-2 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Attributes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg tracking-wide">
                ATTRIBUTES ({attributes.length})
              </h3>
              <button
                type="button"
                onClick={addNewAttribute}
                className="px-3 py-1.5 rounded-lg border border-brand-border text-neutral-400 font-mono text-xs hover:text-brand-accent hover:border-brand-accent/40 transition-colors"
              >
                + Add Attribute
              </button>
            </div>
            <div className="space-y-2">
              {attributes.map((a, i) => (
                <div
                  key={i}
                  className="flex gap-2 items-start p-3 rounded-xl border border-brand-border bg-brand-surface"
                >
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={a.name}
                      onChange={(e) => updateAttributeField(i, "name", e.target.value)}
                      className={inputClass}
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={a.description}
                      onChange={(e) => updateAttributeField(i, "description", e.target.value)}
                      className={inputClass}
                      placeholder="Description"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttribute(i)}
                    className="flex-shrink-0 mt-2 w-8 h-8 flex items-center justify-center rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Create button */}
          <div className="pt-2">
            <StatusMessage message={createMessage} />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="mt-3 px-8 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Creating Topic..." : "Create Topic with All Content"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Archetypes Manager ──────────────────────────────────────────────────────

type ArchetypeRow = {
  id: string;
  name: string;
  base_description: string;
  icon: string;
  attribute_weights: Record<string, number>;
};

function ArchetypesManager({ topics }: { topics: Topic[] }) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ name: string }[]>([]);
  const [archetypes, setArchetypes] = useState<ArchetypeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // AI-generated preview before saving
  const [preview, setPreview] = useState<{ name: string; base_description: string; icon: string; attribute_weights: Record<string, number> }[] | null>(null);

  // Load attributes, subjects, and existing archetypes when topic changes
  async function handleTopicSelect(topicId: string) {
    setSelectedTopicId(topicId);
    setMessage(null);
    setPreview(null);
    setLoading(true);
    try {
      const [attrsResult, subsResult, existing] = await Promise.all([
        getAttributesForTopic(topicId),
        getSubjectsForTopic(topicId),
        fetchExistingArchetypes(topicId),
      ]);
      setAttributes((attrsResult.data ?? []).map((a) => ({ id: a.id, name: a.name })));
      setSubjects((subsResult.data ?? []).map((s) => ({ name: s.name })));
      setArchetypes(existing);
    } catch {
      setMessage({ type: "error", text: "Failed to load topic data" });
    }
    setLoading(false);
  }

  async function fetchExistingArchetypes(topicId: string): Promise<ArchetypeRow[]> {
    // Use a dynamic import to avoid importing the client at module level
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("topic_archetypes")
      .select("id, name, base_description, icon, attribute_weights")
      .eq("topic_id", topicId);
    return (data ?? []).map((r) => ({
      ...r,
      attribute_weights: (r.attribute_weights as Record<string, number>) ?? {},
    }));
  }

  async function handleGenerate() {
    if (!selectedTopicId || attributes.length === 0) return;
    setGenerating(true);
    setMessage(null);
    setPreview(null);
    try {
      const res = await fetch("/api/ai/generate-archetypes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicTitle: topics.find((t) => t.id === selectedTopicId)?.title ?? "",
          attributes,
          subjects,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "API error");
      }
      const data = await res.json();
      setPreview(data.archetypes);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Generation failed" });
    }
    setGenerating(false);
  }

  async function handleSave() {
    if (!selectedTopicId || !preview) return;
    setSaving(true);
    setMessage(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Delete existing archetypes for this topic
      await supabase.from("topic_archetypes").delete().eq("topic_id", selectedTopicId);

      // Insert new ones
      const rows = preview.map((a) => ({
        topic_id: selectedTopicId,
        name: a.name,
        base_description: a.base_description,
        icon: a.icon,
        attribute_weights: a.attribute_weights,
      }));
      const { error } = await supabase.from("topic_archetypes").insert(rows);
      if (error) throw error;

      setMessage({ type: "success", text: `Saved ${rows.length} archetypes!` });
      setPreview(null);
      // Refresh existing list
      const existing = await fetchExistingArchetypes(selectedTopicId);
      setArchetypes(existing);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    }
    setSaving(false);
  }

  async function handleDeleteAll() {
    if (!selectedTopicId) return;
    setSaving(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.from("topic_archetypes").delete().eq("topic_id", selectedTopicId);
      setArchetypes([]);
      setMessage({ type: "success", text: "All archetypes deleted." });
    } catch {
      setMessage({ type: "error", text: "Delete failed" });
    }
    setSaving(false);
  }

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  return (
    <div className="p-5 space-y-5">
      <h3 className="font-display text-xl tracking-wide">ARCHETYPES</h3>
      <p className="text-sm font-body text-neutral-400">
        Generate voter identity archetypes for a topic. Each archetype represents a distinct
        philosophy of greatness.
      </p>

      {/* Topic selector */}
      <div>
        <label className={labelClass}>Select Topic</label>
        <select
          className={inputClass}
          value={selectedTopicId ?? ""}
          onChange={(e) => e.target.value && handleTopicSelect(e.target.value)}
        >
          <option value="">Choose a topic...</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm font-mono text-neutral-500">Loading...</p>}

      {selectedTopicId && !loading && (
        <>
          {/* Info */}
          <div className="text-xs font-mono text-neutral-600 space-y-1">
            <p>{attributes.length} attributes | {subjects.length} subjects</p>
            {archetypes.length > 0 && (
              <p className="text-brand-accent">{archetypes.length} archetypes exist</p>
            )}
          </div>

          {/* Existing archetypes */}
          {archetypes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Current Archetypes</h4>
              {archetypes.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-brand-surface border border-brand-border">
                  <p className="font-display text-sm tracking-wide">{a.icon} {a.name.toUpperCase()}</p>
                  <p className="text-xs text-neutral-400 font-body mt-1">{a.base_description}</p>
                </div>
              ))}
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={saving}
                className="text-xs font-mono text-brand-red hover:text-red-400 transition-colors"
              >
                Delete All Archetypes
              </button>
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || attributes.length === 0}
            className="w-full px-4 py-3 rounded-xl font-mono text-sm font-bold transition-all
                       bg-brand-accent/10 text-brand-accent border border-brand-accent/30
                       hover:bg-brand-accent/20 hover:border-brand-accent/50
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? "Generating..." : `Generate 5 Archetypes for "${selectedTopic?.title ?? ""}"`}
          </button>

          {/* Preview */}
          {preview && (
            <div className="space-y-3">
              <h4 className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Preview — AI Generated</h4>
              {preview.map((a, i) => (
                <div key={i} className="p-3 rounded-xl bg-brand-surface border border-brand-accent/20">
                  <p className="font-display text-sm tracking-wide text-brand-accent">{a.icon} {a.name.toUpperCase()}</p>
                  <p className="text-xs text-neutral-300 font-body mt-1">{a.base_description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(a.attribute_weights).map(([attrId, weight]) => {
                      const attrName = attributes.find((at) => at.id === attrId)?.name ?? attrId.slice(0, 8);
                      return (
                        <span key={attrId} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                          {attrName}: {weight}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-3 rounded-xl font-mono text-sm font-bold transition-all
                           bg-green-500/10 text-green-400 border border-green-500/30
                           hover:bg-green-500/20 hover:border-green-500/50
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Archetypes"}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="w-full px-4 py-2 rounded-xl font-mono text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                Regenerate
              </button>
            </div>
          )}

          <StatusMessage message={message} />
        </>
      )}
    </div>
  );
}

// ── Main AdminForms — Miller columns layout ──────────────────────────────────

export function AdminForms({ topics }: { topics: Topic[] }) {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [selectedItem, setSelectedItem] = useState<TopicRow | SubjectRow | AttributeRow | SuggestionRow | null>(null);
  const [lastDeletedTopicId, setLastDeletedTopicId] = useState<string | null>(null);

  // Column widths (desktop)
  const [col1W, setCol1W] = useState(220);
  const [col2W, setCol2W] = useState(400);

  const hasCol3 =
    activeSection === "manage-topics" ||
    activeSection === "manage-subjects" ||
    activeSection === "manage-attributes" ||
    activeSection === "manage-suggestions";

  function handleSectionClick(id: SectionId) {
    setActiveSection(id);
    setSelectedItem(null);
  }

  // ── Column 2 content ──────────────────────────────────────────────────────

  function renderCol2() {
    switch (activeSection) {
      case "ai-builder":
        return <AiTopicBuilder />;
      case "create-topic":
        return <CreateTopicForm />;
      case "manage-topics":
        return (
          <TopicsList
            onSelect={(t) => setSelectedItem(t)}
            selectedId={selectedItem?.id ?? null}
            deletedId={lastDeletedTopicId}
          />
        );
      case "manage-subjects":
        return (
          <SubjectsList
            topics={topics}
            onSelect={(s) => setSelectedItem(s)}
            selectedId={selectedItem?.id ?? null}
            onDeleted={(ids) => {
              if (selectedItem && ids.includes(selectedItem.id)) setSelectedItem(null);
            }}
          />
        );
      case "manage-attributes":
        return (
          <AttributesList
            topics={topics}
            onSelect={(a) => setSelectedItem(a)}
            selectedId={selectedItem?.id ?? null}
            onDeleted={(ids) => {
              if (selectedItem && ids.includes(selectedItem.id)) setSelectedItem(null);
            }}
          />
        );
      case "manage-archetypes":
        return <ArchetypesManager topics={topics} />;
      case "manage-suggestions":
        return (
          <SuggestionsList
            onSelect={(s) => setSelectedItem(s)}
            selectedId={selectedItem?.id ?? null}
          />
        );
      default:
        return null;
    }
  }

  // ── Column 3 content ──────────────────────────────────────────────────────

  function renderCol3() {
    if (!selectedItem) return null;

    if (activeSection === "manage-topics") {
      return (
        <EditTopicForm
          key={selectedItem.id}
          topic={selectedItem as TopicRow}
          onSave={(updated) => setSelectedItem(updated)}
          onCancel={() => setSelectedItem(null)}
          onDelete={() => {
            const deletedId = (selectedItem as TopicRow).id;
            setSelectedItem(null);
            setLastDeletedTopicId(deletedId);
          }}
        />
      );
    }
    if (activeSection === "manage-subjects") {
      return (
        <EditSubjectForm
          key={selectedItem.id}
          subject={selectedItem as SubjectRow}
          onSave={(updated) => setSelectedItem(updated)}
          onCancel={() => setSelectedItem(null)}
        />
      );
    }
    if (activeSection === "manage-attributes") {
      return (
        <EditAttributeForm
          key={selectedItem.id}
          attribute={selectedItem as AttributeRow}
          onSave={(updated) => setSelectedItem(updated)}
          onCancel={() => setSelectedItem(null)}
        />
      );
    }
    if (activeSection === "manage-suggestions") {
      return (
        <SuggestionDetail
          key={selectedItem.id}
          suggestion={selectedItem as SuggestionRow}
          onClose={() => setSelectedItem(null)}
          onUpdate={(updated) => {
            if (updated) {
              setSelectedItem(updated);
            } else {
              setSelectedItem(null);
            }
          }}
        />
      );
    }
    return null;
  }

  // ── Mobile: stacked layout ────────────────────────────────────────────────

  const mobileContent = (
    <div className="md:hidden space-y-4">
      {/* Section nav */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => handleSectionClick(sec.id)}
            className={`px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
              activeSection === sec.id
                ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/30"
                : "text-neutral-400 border border-brand-border hover:text-white hover:bg-neutral-800"
            }`}
          >
            {sec.icon} {sec.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSection && (
        <div className="border border-brand-border rounded-2xl overflow-hidden bg-brand-surface/30">
          {renderCol2()}
        </div>
      )}

      {/* Detail / edit */}
      {selectedItem && hasCol3 && (
        <div className="border border-brand-border rounded-2xl overflow-hidden bg-brand-surface/30">
          {renderCol3()}
        </div>
      )}
    </div>
  );

  // ── Desktop: Miller columns ───────────────────────────────────────────────

  const showCol2 = activeSection !== null;
  const showCol3 = hasCol3 && selectedItem !== null;

  const desktopContent = (
    <div className="hidden md:flex h-[calc(100vh-140px)] border border-brand-border rounded-2xl overflow-hidden bg-brand-surface/20">
      {/* Column 1: Navigation sidebar */}
      <div
        className="flex-shrink-0 border-r border-brand-border bg-neutral-900/60 overflow-y-auto"
        style={{ width: col1W }}
      >
        <div className="p-3">
          <div className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest px-2 mb-2">
            Sections
          </div>
          <ul className="space-y-0.5">
            {SECTIONS.map((sec) => (
              <li key={sec.id}>
                <button
                  type="button"
                  onClick={() => handleSectionClick(sec.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-mono transition-colors flex items-center gap-2 ${
                    activeSection === sec.id
                      ? "bg-brand-accent/10 text-brand-accent"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  <span className="text-base leading-none opacity-60">{sec.icon}</span>
                  <span className="truncate">{sec.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Divider 1 */}
      {showCol2 && (
        <ColumnDivider
          onDrag={(delta) =>
            setCol1W((w) => Math.max(200, Math.min(600, w + delta)))
          }
        />
      )}

      {/* Column 2: Section content / list */}
      {showCol2 && (
        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{ width: col2W, borderRight: "1px solid var(--brand-border, #2a2a2a)" }}
        >
          {renderCol2()}
        </div>
      )}

      {/* Divider 2 — shown for all list sections so col2 stays resizable even without a selection */}
      {showCol2 && hasCol3 && (
        <ColumnDivider
          onDrag={(delta) =>
            setCol2W((w) => Math.max(400, Math.min(700, w + delta)))
          }
        />
      )}

      {/* Column 3: Edit form / detail */}
      {showCol3 && (
        <div className="flex-1 min-w-0 overflow-y-auto">
          {renderCol3()}
        </div>
      )}

      {/* Empty state when no col3 but col2 is a form section */}
      {showCol2 && !showCol3 && !hasCol3 && (
        <div className="flex-1 min-w-0" />
      )}

      {/* Empty state for list sections with no selection */}
      {showCol2 && !showCol3 && hasCol3 && (
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <p className="text-neutral-600 font-mono text-sm">Select an item to edit</p>
        </div>
      )}

      {/* Empty state when nothing selected */}
      {!showCol2 && (
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <p className="text-neutral-600 font-mono text-sm">Select a section to get started</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {desktopContent}
      {mobileContent}
    </>
  );
}
