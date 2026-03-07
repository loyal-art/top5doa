"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createTopic,
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
    </section>
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
    <section className="border border-brand-border rounded-2xl p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">ADD SUBJECT</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body">
          No topics yet. Create a topic first.
        </p>
      ) : (
        <div className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
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
            <form onSubmit={handleBulkSubmit} className="space-y-4 max-w-lg">
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
    </section>
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
      setBulkMessage({ type: "error", text: result.error });
    } else {
      setBulkMessage({
        type: "success",
        text: `Added ${result.count} attribute${result.count === 1 ? "" : "s"}!`,
      });
      (e.target as HTMLFormElement).reset();
    }
    setBulkLoading(false);
  }

  return (
    <section className="border border-brand-border rounded-2xl p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">ADD ATTRIBUTE</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body">
          No topics yet. Create a topic first.
        </p>
      ) : (
        <div className="space-y-8">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
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
            <form onSubmit={handleBulkSubmit} className="space-y-4 max-w-lg">
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
    </section>
  );
}

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
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 pl-4 border-l-2 border-brand-accent/30">
      <div className="grid grid-cols-2 gap-3">
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
          <label className={labelClass}>Era</label>
          <input
            type="text"
            value={fields.era}
            onChange={(e) => setFields((f) => ({ ...f, era: e.target.value }))}
            className={inputClass}
            placeholder="1984–2003"
          />
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
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-brand-accent text-brand-bg font-mono text-sm font-bold hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-brand-border text-neutral-400 font-mono text-sm hover:text-white hover:border-neutral-500 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
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
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 pl-4 border-l-2 border-brand-accent/30">
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
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-brand-accent text-brand-bg font-mono text-sm font-bold hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-brand-border text-neutral-400 font-mono text-sm hover:text-white hover:border-neutral-500 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ManageSubjectsSection({ topics }: { topics: Topic[] }) {
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadSubjects(topicId: string) {
    setLoadingList(true);
    setListError(null);
    setEditingId(null);
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
    setEditingId(null);
    if (id) loadSubjects(id);
  }

  return (
    <section className="border border-brand-border rounded-2xl p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">MANAGE SUBJECTS</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body">No topics yet. Create a topic first.</p>
      ) : (
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className={labelClass}>Topic</label>
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
            <p className="text-sm font-mono text-neutral-500">Loading...</p>
          )}
          {listError && (
            <p className="text-sm font-mono text-brand-red">{listError}</p>
          )}

          {!loadingList && selectedTopicId && subjects.length === 0 && !listError && (
            <p className="text-sm font-mono text-neutral-500">No subjects found for this topic.</p>
          )}

          {subjects.length > 0 && (
            <ul className="space-y-2">
              {subjects.map((subject) => (
                <li key={subject.id} className="rounded-xl border border-brand-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-body text-white">{subject.name}</span>
                      {subject.era && (
                        <span className="ml-2 text-xs font-mono text-neutral-500">{subject.era}</span>
                      )}
                    </div>
                    {editingId !== subject.id && (
                      <button
                        type="button"
                        onClick={() => setEditingId(subject.id)}
                        className="shrink-0 px-3 py-1.5 rounded-lg border border-brand-border text-neutral-400 font-mono text-xs hover:text-white hover:border-neutral-500 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editingId === subject.id && (
                    <EditSubjectForm
                      subject={subject}
                      onSave={(updated) => {
                        setSubjects((prev) =>
                          prev.map((s) => (s.id === updated.id ? updated : s))
                        );
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ManageAttributesSection({ topics }: { topics: Topic[] }) {
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadAttributes(topicId: string) {
    setLoadingList(true);
    setListError(null);
    setEditingId(null);
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
    setEditingId(null);
    if (id) loadAttributes(id);
  }

  return (
    <section className="border border-brand-border rounded-2xl p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">MANAGE ATTRIBUTES</h2>
      {topics.length === 0 ? (
        <p className="text-neutral-500 font-body">No topics yet. Create a topic first.</p>
      ) : (
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className={labelClass}>Topic</label>
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
            <p className="text-sm font-mono text-neutral-500">Loading...</p>
          )}
          {listError && (
            <p className="text-sm font-mono text-brand-red">{listError}</p>
          )}

          {!loadingList && selectedTopicId && attributes.length === 0 && !listError && (
            <p className="text-sm font-mono text-neutral-500">No attributes found for this topic.</p>
          )}

          {attributes.length > 0 && (
            <ul className="space-y-2">
              {attributes.map((attribute) => (
                <li key={attribute.id} className="rounded-xl border border-brand-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-body text-white">{attribute.name}</span>
                      {attribute.description && (
                        <span className="ml-2 text-xs font-mono text-neutral-500">{attribute.description}</span>
                      )}
                    </div>
                    {editingId !== attribute.id && (
                      <button
                        type="button"
                        onClick={() => setEditingId(attribute.id)}
                        className="shrink-0 px-3 py-1.5 rounded-lg border border-brand-border text-neutral-400 font-mono text-xs hover:text-white hover:border-neutral-500 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editingId === attribute.id && (
                    <EditAttributeForm
                      attribute={attribute}
                      onSave={(updated) => {
                        setAttributes((prev) =>
                          prev.map((a) => (a.id === updated.id ? updated : a))
                        );
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function EditTopicForm({
  topic,
  onSave,
  onCancel,
}: {
  topic: TopicRow;
  onSave: (updated: TopicRow) => void;
  onCancel: () => void;
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

    const result = await updateTopic(topic.id, {
      title: fields.title,
      description: fields.description || null,
      category: fields.category,
      status: fields.status as "draft" | "coming_soon" | "active" | "archived",
      cover_image_url: fields.cover_image_url || null,
      card_image_url: fields.card_image_url || null,
      card_video_url: fields.card_video_url || null,
      video_url: fields.video_url || null,
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
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 pl-4 border-l-2 border-brand-accent/30">
      <div className="grid grid-cols-2 gap-3">
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
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-brand-accent text-brand-bg font-mono text-sm font-bold hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-brand-border text-neutral-400 font-mono text-sm hover:text-white hover:border-neutral-500 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ManageTopicsSection() {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const result = await getTopics();
    if (result.error) {
      setLoadError(result.error);
    } else {
      setTopics(result.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="border border-brand-border rounded-2xl p-6">
      <h2 className="font-display text-2xl tracking-wide mb-6">MANAGE TOPICS</h2>

      {loading && <p className="text-sm font-mono text-neutral-500">Loading...</p>}
      {loadError && <p className="text-sm font-mono text-brand-red">{loadError}</p>}
      {!loading && !loadError && topics.length === 0 && (
        <p className="text-neutral-500 font-body">No topics yet. Create a topic first.</p>
      )}

      {topics.length > 0 && (
        <ul className="space-y-2 max-w-2xl">
          {topics.map((topic) => (
            <li key={topic.id} className="rounded-xl border border-brand-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="font-body text-white">{topic.title}</span>
                  <span className="ml-2 text-xs font-mono text-neutral-500">{topic.category.join(", ")}</span>
                  <span className="ml-2 text-xs font-mono text-neutral-600">{topic.status}</span>
                </div>
                {editingId !== topic.id && (
                  <button
                    type="button"
                    onClick={() => setEditingId(topic.id)}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-brand-border text-neutral-400 font-mono text-xs hover:text-white hover:border-neutral-500 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingId === topic.id && (
                <EditTopicForm
                  topic={topic}
                  onSave={(updated) => {
                    setTopics((prev) =>
                      prev.map((t) => (t.id === updated.id ? updated : t))
                    );
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminForms({ topics }: { topics: Topic[] }) {
  return (
    <div className="space-y-10">
      <CreateTopicForm />
      <ManageTopicsSection />
      <AddSubjectForm topics={topics} />
      <AddAttributeForm topics={topics} />
      <ManageSubjectsSection topics={topics} />
      <ManageAttributesSection topics={topics} />
    </div>
  );
}
