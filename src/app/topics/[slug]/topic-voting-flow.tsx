"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type html2canvasType from "html2canvas";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SubjectScoreSlider } from "@/components/subject-score-slider";
import { ShareButton } from "@/components/share-button";
import { AttributeRanker } from "./attribute-ranker";
import type { Database } from "@/lib/types/database";

type Topic = Database["public"]["Tables"]["topics"]["Row"];
type Subject = Database["public"]["Tables"]["subjects"]["Row"];
type Attribute = Database["public"]["Tables"]["attributes"]["Row"];

interface TopicVotingFlowProps {
  topic: Topic;
  subjects: Subject[];
  attributes: Attribute[];
  weights: number[];
  globalRankings?: { subject: Subject; score: number }[];
  voterCount: number;
}

type PipContent = { url: string; type: "photo" | "music" | "video" } | null;

function PipPanel({ content, onClose }: { content: PipContent; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, left: 0, top: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        left: dragStart.current.left + (e.clientX - dragStart.current.mx),
        top: dragStart.current.top + (e.clientY - dragStart.current.my),
      });
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!content) return null;

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, left: rect.left, top: rect.top };
    e.preventDefault();
  };

  const style: React.CSSProperties = pos
    ? { position: "fixed", left: pos.left, top: pos.top, zIndex: 9999, width: 380 }
    : { position: "fixed", right: 24, bottom: 24, zIndex: 9999, width: 380 };

  return (
    <div ref={panelRef} style={style} className="rounded-xl overflow-hidden shadow-2xl border border-neutral-700 bg-neutral-900 flex flex-col">
      {/* Drag handle */}
      <div
        onMouseDown={handleDragMouseDown}
        className="flex items-center justify-between px-3 py-2 bg-neutral-800 cursor-grab active:cursor-grabbing select-none border-b border-neutral-700"
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
          </div>
          <span className="text-xs font-mono text-neutral-400 tracking-widest uppercase">
            {content.type === "photo" ? "Photo" : content.type === "music" ? "Music" : "Video"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="w-full bg-black" style={{ height: content.type === "photo" ? "auto" : 240 }}>
        {content.type === "photo" ? (
          content.url.includes("google.com/search") ? (
            <div className="flex items-center justify-center p-6">
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-mono font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                🔍 Search Google Images
              </a>
            </div>
          ) : (
            <img src={content.url} alt="Subject photo" className="w-full h-auto object-contain max-h-[400px]" />
          )
        ) : (
          <iframe
            src={content.url}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            title="Media preview"
          />
        )}
      </div>
    </div>
  );
}

function SubjectLinks({
  subject,
  topicTitle,
  onOpen,
}: {
  subject: Subject;
  topicTitle: string;
  onOpen: (url: string, type: "photo" | "music" | "video") => void;
}) {
  const hasRealPhoto = !!subject.link_photo && !subject.link_photo.includes("google.com/search");
  const photoUrl = subject.link_photo ?? `https://www.google.com/search?q=${encodeURIComponent(`${subject.name} ${topicTitle}`)}&tbm=isch`;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {hasRealPhoto ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(subject.link_photo!, "photo"); }}
          className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-neutral-700 hover:border-blue-500 transition-colors"
        >
          <img src={subject.link_photo!} alt={subject.name} className="w-full h-full object-cover" />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(photoUrl, "photo"); }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          📷 PHOTO
        </button>
      )}
      {subject.link_music && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(subject.link_music!, "music"); }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold text-white bg-green-600 hover:bg-green-500 transition-colors"
        >
          🎵 MUSIC
        </button>
      )}
      {subject.link_video && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(subject.link_video!, "video"); }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors"
        >
          🎬 VIDEO
        </button>
      )}
    </div>
  );
}


type Step = "rank" | "select" | "score" | "results";
type VoteMode = "by-subject" | "by-attribute";

const STEP_META: Record<Step, { num: number; label: string }> = {
  rank: { num: 1, label: "RANK ATTRIBUTES" },
  select: { num: 2, label: "SELECT SUBJECTS" },
  score: { num: 3, label: "SCORE SUBJECTS" },
  results: { num: 4, label: "YOUR TOP 5" },
};

const MIN_SELECTED_SUBJECTS = 5;

export function TopicVotingFlow({
  topic,
  subjects,
  attributes,
  weights,
  globalRankings: initialGlobalRankings,
  voterCount,
}: TopicVotingFlowProps) {
  // Memoize the Supabase client so its reference stays stable across renders.
  // createBrowserClient returns a new object on every call; if it were called
  // directly in the component body, `supabase` would be a different reference
  // each render, causing fetchGlobalRankings (which lists it as a dep) to be
  // recreated every render, which in turn would make the useEffect fire on
  // every render while step === "results" — an infinite re-fetch loop.
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  // Prevents auto-save from firing during initial state restore
  const autoSaveReadyRef = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [step, setStep] = useState<Step>("rank");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentSubjectIdx, setCurrentSubjectIdx] = useState(0);
  const [voteMode, setVoteMode] = useState<VoteMode>("by-subject");
  const [currentAttrIdx, setCurrentAttrIdx] = useState(0);

  // Global community rankings — null = not yet fetched / loading
  const [globalRankings, setGlobalRankings] = useState<
    { subject: Subject; score: number }[] | null
  >(initialGlobalRankings ?? null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [recentVoters, setRecentVoters] = useState<
    { username: string; display_name: string; avatar_url: string | null; topPick: string | null }[]
  >([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [pipContent, setPipContent] = useState<PipContent>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState<"top" | "bottom" | null>(null);
  const shareMenuTopRef = useRef<HTMLDivElement>(null);
  const shareMenuBottomRef = useRef<HTMLDivElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Hot Take state
  const [hotTakeOpen, setHotTakeOpen] = useState(false);
  const [hotTakeTarget, setHotTakeTarget] = useState<{
    type: "subject" | "attribute";
    id: string;
    name: string;
  } | null>(null);
  const [hotTakeText, setHotTakeText] = useState("");
  const [hotTakeExistingId, setHotTakeExistingId] = useState<string | null>(null);
  const [hotTakeSaving, setHotTakeSaving] = useState(false);

  async function openHotTake(targetType: "subject" | "attribute", targetId: string, targetName: string) {
    setHotTakeTarget({ type: targetType, id: targetId, name: targetName });
    setHotTakeText("");
    setHotTakeExistingId(null);
    setHotTakeOpen(true);
    if (!userId) return;
    // Check for existing take
    const col = targetType === "subject" ? "subject_id" : "attribute_id";
    const { data } = await supabase
      .from("hot_takes")
      .select("id, content")
      .eq("user_id", userId)
      .eq("topic_id", topic.id)
      .eq(col, targetId)
      .maybeSingle();
    if (data) {
      setHotTakeText(data.content);
      setHotTakeExistingId(data.id);
    }
  }

  async function submitHotTake() {
    if (!userId || !hotTakeTarget || !hotTakeText.trim() || hotTakeText.length > 280) return;
    setHotTakeSaving(true);

    if (hotTakeExistingId) {
      await supabase.from("hot_takes").update({ content: hotTakeText.trim() }).eq("id", hotTakeExistingId);
    } else {
      await supabase.from("hot_takes").insert({
        user_id: userId,
        topic_id: topic.id,
        content: hotTakeText.trim(),
        subject_id: hotTakeTarget.type === "subject" ? hotTakeTarget.id : null,
        attribute_id: hotTakeTarget.type === "attribute" ? hotTakeTarget.id : null,
      });
    }
    setHotTakeSaving(false);
    setHotTakeOpen(false);
  }

  async function deleteHotTake() {
    if (!hotTakeExistingId) return;
    setHotTakeSaving(true);
    await supabase.from("hot_takes").delete().eq("id", hotTakeExistingId);
    setHotTakeSaving(false);
    setHotTakeOpen(false);
  }

  // Selected subjects for the "select" step — IDs of subjects the user wants to score
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(
    () => new Set(subjects.map((s) => s.id)),
  );

  // Attribute ranking: attribute IDs ordered by importance (index 0 = most important)
  const [rankedAttributeIds, setRankedAttributeIds] = useState<string[]>(
    attributes.map((a) => a.id),
  );

  // Subject scores: { [subjectId]: { [attributeId]: score } }
  const [scores, setScores] = useState<Record<string, Record<string, number>>>(
    () => {
      const initial: Record<string, Record<string, number>> = {};
      for (const subject of subjects) {
        initial[subject.id] = {};
        for (const attr of attributes) {
          initial[subject.id][attr.id] = 50;
        }
      }
      return initial;
    },
  );

  // Check auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      // No user — nothing to load, stop initializing immediately
      if (!user) setInitializing(false);
    });
  }, [supabase]);

  // Fetch community global rankings from the security-definer RPC.
  // Runs whenever the user reaches the results step, and again after saving.
  const fetchGlobalRankings = useCallback(async () => {
    setGlobalLoading(true);
    const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
    const { data, error } = await supabase.rpc("get_global_rankings", {
      p_topic_id: topic.id,
    });
    if (error) {
      // Do NOT set globalRankings to [] on error — that would incorrectly
      // display "No community votes yet" when the real problem is a network
      // or database error.  Leave the previous state intact so the UI stays
      // consistent, and surface the error to the console for debugging.
      console.error("[global rankings] RPC error:", error);
    } else {
      const ranked = (data ?? [])
        .map((r) => ({ subject: subjectMap[r.subject_id], score: Number(r.avg_score) }))
        .filter((r): r is { subject: Subject; score: number } => r.subject != null);
      setGlobalRankings(ranked);
    }
    setGlobalLoading(false);
  }, [supabase, topic.id, subjects]);

  // Fetch the most recent 10 distinct voters for this topic
  const fetchRecentVoters = useCallback(async () => {
    // Get distinct user_ids ordered by most recent vote
    const { data: rows } = await supabase
      .from("user_lists")
      .select("user_id, created_at")
      .eq("topic_id", topic.id)
      .order("created_at", { ascending: false });
    if (!rows || rows.length === 0) {
      setRecentVoters([]);
      return;
    }
    // Deduplicate by user_id, keeping the most recent entry
    const seen = new Set<string>();
    const uniqueUserIds: string[] = [];
    for (const row of rows) {
      if (!seen.has(row.user_id)) {
        seen.add(row.user_id);
        uniqueUserIds.push(row.user_id);
      }
      if (uniqueUserIds.length >= 10) break;
    }
    // Fetch profiles and #1 picks in parallel
    const [{ data: profiles }, { data: topPicks }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", uniqueUserIds),
      supabase
        .from("user_lists")
        .select("user_id, subject_id, subjects(name)")
        .eq("topic_id", topic.id)
        .eq("rank_position", 1)
        .in("user_id", uniqueUserIds),
    ]);
    if (!profiles) {
      setRecentVoters([]);
      return;
    }
    // Build lookup maps
    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const topPickMap = new Map<string, string>();
    if (topPicks) {
      for (const pick of topPicks) {
        const subj = pick.subjects as unknown as { name: string } | null;
        if (subj?.name) topPickMap.set(pick.user_id, subj.name);
      }
    }
    // Preserve recency order and filter out profiles without a username
    const voters = uniqueUserIds
      .map((uid) => profileMap.get(uid))
      .filter((p) => p != null && p.username != null)
      .map((p) => ({
        username: p!.username,
        display_name: p!.display_name,
        avatar_url: p!.avatar_url ?? null,
        topPick: topPickMap.get(p!.id) ?? null,
      }));
    setRecentVoters(voters);
  }, [supabase, topic.id]);

  // Load existing user data if logged in
  useEffect(() => {
    if (!userId) return;

    async function loadExistingData() {
      console.log("[loadExistingData] starting for topic:", topic.id, "user:", userId);
      // Fetch profile + check for an already-locked list in parallel
      const [{ data: profile }, { data: lockedList }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, username, is_premium, premium_expires_at")
          .eq("id", userId!)
          .single(),
        supabase
          .from("user_lists")
          .select("subject_id")
          .eq("user_id", userId!)
          .eq("topic_id", topic.id)
          .limit(1),
      ]);

      console.log("[profile] raw result:", profile);
      console.log("[lockedList] result:", lockedList);
      setDisplayName(profile?.display_name ?? null);
      setUsername(profile?.username ?? null);
      setIsPremium(
        profile?.is_premium === true &&
          profile?.premium_expires_at != null &&
          new Date(profile.premium_expires_at) > new Date()
      );

      // Load existing attribute ranks
      const { data: existingRanks, error: ranksError } = await supabase
        .from("user_attribute_ranks")
        .select("attribute_id, rank_position")
        .eq("user_id", userId!)
        .eq("topic_id", topic.id)
        .order("rank_position");

      console.log("[loadExistingData] existingRanks:", existingRanks, "error:", ranksError);

      if (existingRanks && existingRanks.length > 0) {
        const ranked = existingRanks.map((r) => r.attribute_id);
        // Add any attributes that might not have been ranked yet
        const remaining = attributes
          .map((a) => a.id)
          .filter((id) => !ranked.includes(id));
        console.log("[loadExistingData] restoring rankedAttributeIds:", [...ranked, ...remaining]);
        setRankedAttributeIds([...ranked, ...remaining]);
      } else {
        console.log("[loadExistingData] no existing ranks found — using default order");
      }

      // Load existing scores
      const { data: existingScores, error: scoresError } = await supabase
        .from("user_subject_scores")
        .select("subject_id, attribute_id, score")
        .eq("user_id", userId!)
        .eq("topic_id", topic.id);

      console.log("[loadExistingData] existingScores count:", existingScores?.length ?? 0, "error:", scoresError);
      if (existingScores && existingScores.length > 0) {
        console.log("[loadExistingData] sample scores:", existingScores.slice(0, 3));
      }

      if (existingScores && existingScores.length > 0) {
        setScores((prev) => {
          const updated = { ...prev };
          for (const s of existingScores) {
            if (!updated[s.subject_id]) updated[s.subject_id] = {};
            updated[s.subject_id][s.attribute_id] = s.score;
          }
          return updated;
        });
      }

      // If the user already has a locked list, skip straight to the results screen
      if (lockedList && lockedList.length > 0) {
        console.log("[loadExistingData] locked list found — skipping to results");
        setStep("results");
        setSaved(true);
        fetchGlobalRankings();
        fetchRecentVoters();
      }

      console.log("[loadExistingData] done — calling setInitializing(false)");
      setInitializing(false);
    }

    loadExistingData();
  }, [userId, topic.id, supabase, attributes, fetchGlobalRankings, fetchRecentVoters]);

  // Enable auto-save one tick after initialization so the initial state restore
  // doesn't trigger a spurious write-back to the database.
  useEffect(() => {
    if (!initializing && userId) {
      console.log("[autoSave] initialization complete — scheduling autoSaveReadyRef = true");
      const timer = setTimeout(() => {
        console.log("[autoSave] autoSaveReadyRef is now TRUE — auto-save enabled");
        autoSaveReadyRef.current = true;
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initializing, userId]);

  // Debounced auto-save: attribute rankings
  useEffect(() => {
    console.log("[autoSave:ranks] effect ran — userId:", userId, "autoSaveReady:", autoSaveReadyRef.current, "ids:", rankedAttributeIds);
    if (!userId || !autoSaveReadyRef.current) return;
    setAutoSaveStatus("saving");
    const timer = setTimeout(async () => {
      console.log("[autoSave:ranks] debounce fired — saving", rankedAttributeIds.length, "ranks");
      const { error: delError } = await supabase
        .from("user_attribute_ranks")
        .delete()
        .eq("user_id", userId)
        .eq("topic_id", topic.id);
      console.log("[autoSave:ranks] delete result — error:", delError);
      if (rankedAttributeIds.length > 0) {
        const { error: insertError } = await supabase.from("user_attribute_ranks").insert(
          rankedAttributeIds.map((attrId, idx) => ({
            user_id: userId,
            topic_id: topic.id,
            attribute_id: attrId,
            rank_position: idx + 1,
          })),
        );
        console.log("[autoSave:ranks] insert result — error:", insertError);
      }
      setAutoSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setAutoSaveStatus("idle"), 2000);
    }, 500);
    return () => clearTimeout(timer);
  }, [rankedAttributeIds, userId, supabase, topic.id]);

  // Debounced auto-save: subject scores (only selected subjects)
  useEffect(() => {
    console.log("[autoSave:scores] effect ran — userId:", userId, "autoSaveReady:", autoSaveReadyRef.current);
    if (!userId || !autoSaveReadyRef.current) return;
    setAutoSaveStatus("saving");
    const timer = setTimeout(async () => {
      const rows: { user_id: string; topic_id: string; subject_id: string; attribute_id: string; score: number }[] = [];
      for (const subjectId of Object.keys(scores)) {
        if (!selectedSubjectIds.has(subjectId)) continue;
        for (const attrId of Object.keys(scores[subjectId])) {
          rows.push({
            user_id: userId,
            topic_id: topic.id,
            subject_id: subjectId,
            attribute_id: attrId,
            score: scores[subjectId][attrId],
          });
        }
      }
      console.log("[autoSave:scores] debounce fired — upserting", rows.length, "score rows");
      if (rows.length > 0) {
        const { error } = await supabase
          .from("user_subject_scores")
          .upsert(rows, { onConflict: "user_id,subject_id,attribute_id" });
        console.log("[autoSave:scores] upsert result — error:", error);
      }
      setAutoSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setAutoSaveStatus("idle"), 2000);
    }, 500);
    return () => clearTimeout(timer);
  }, [scores, userId, supabase, topic.id, selectedSubjectIds]);

  // Compute ranked attribute objects in order
  const rankedAttributes = useMemo(
    () =>
      rankedAttributeIds
        .map((id) => attributes.find((a) => a.id === id))
        .filter((a): a is Attribute => !!a),
    [rankedAttributeIds, attributes],
  );

  // Subjects filtered to only the selected ones (for scoring step)
  const selectedSubjects = useMemo(
    () => subjects.filter((s) => selectedSubjectIds.has(s.id)),
    [subjects, selectedSubjectIds],
  );

  const currentSubject = selectedSubjects[currentSubjectIdx];
  const currentAttr = rankedAttributes[currentAttrIdx];

  // Calculate weighted score for a single subject
  const calculateSubjectScore = useCallback(
    (subjectId: string) => {
      if (!weights.length || !rankedAttributeIds.length) return 0;
      let total = 0;
      for (let i = 0; i < rankedAttributeIds.length && i < weights.length; i++) {
        const attrId = rankedAttributeIds[i];
        const score = scores[subjectId]?.[attrId] ?? 50;
        total += score * (weights[i] / 100);
      }
      return Math.round(total * 100) / 100;
    },
    [weights, rankedAttributeIds, scores],
  );

  // Generate ranked results
  const results = useMemo(() => {
    return subjects
      .map((s) => ({
        subject: s,
        score: calculateSubjectScore(s.id),
      }))
      .sort((a, b) => b.score - a.score);
  }, [subjects, calculateSubjectScore]);

  // Save all data to Supabase
  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setSaved(false);

    try {
      // Delete then insert attribute ranks to avoid unique constraint violations
      // on rank_position when the user re-orders attributes between saves.
      await supabase
        .from("user_attribute_ranks")
        .delete()
        .eq("user_id", userId)
        .eq("topic_id", topic.id);

      const rankRows = rankedAttributeIds.map((attrId, idx) => ({
        user_id: userId,
        topic_id: topic.id,
        attribute_id: attrId,
        rank_position: idx + 1,
      }));
      await supabase.from("user_attribute_ranks").insert(rankRows);

      // For unselected subjects: assign (lowest score among selected - 1) per attribute
      const unselectedIds = subjects
        .map((s) => s.id)
        .filter((id) => !selectedSubjectIds.has(id));

      const allScoreRows: { user_id: string; topic_id: string; subject_id: string; attribute_id: string; score: number }[] = [];

      // Build rows for selected subjects (user-provided scores)
      for (const subjectId of Object.keys(scores)) {
        if (!selectedSubjectIds.has(subjectId)) continue;
        for (const attrId of Object.keys(scores[subjectId])) {
          allScoreRows.push({
            user_id: userId,
            topic_id: topic.id,
            subject_id: subjectId,
            attribute_id: attrId,
            score: scores[subjectId][attrId],
          });
        }
      }

      // Build rows for unselected subjects — (lowest selected score - 1) per attribute
      if (unselectedIds.length > 0) {
        for (const attrId of rankedAttributeIds) {
          let lowest = Infinity;
          for (const subjectId of subjects.map((s) => s.id)) {
            if (!selectedSubjectIds.has(subjectId)) continue;
            const s = scores[subjectId]?.[attrId] ?? 50;
            if (s < lowest) lowest = s;
          }
          const unselectedScore = Math.max(1, lowest - 1);
          for (const subjectId of unselectedIds) {
            allScoreRows.push({
              user_id: userId,
              topic_id: topic.id,
              subject_id: subjectId,
              attribute_id: attrId,
              score: unselectedScore,
            });
          }
        }
      }

      // Upsert all score rows
      for (const row of allScoreRows) {
        await supabase.from("user_subject_scores").upsert(row, {
          onConflict: "user_id,subject_id,attribute_id",
        });
      }

      // Delete then insert user list for the same reason as attribute ranks:
      // re-saves with different orderings would violate UNIQUE(user_id, topic_id, rank_position).
      await supabase
        .from("user_lists")
        .delete()
        .eq("user_id", userId)
        .eq("topic_id", topic.id);

      const listRows = results.map((r, i) => ({
        user_id: userId,
        topic_id: topic.id,
        subject_id: r.subject.id,
        calculated_score: r.score,
        rank_position: i + 1,
      }));
      await supabase.from("user_lists").insert(listRows);

      setSaved(true);
      // Refetch so the community tally reflects this user's new vote
      await fetchGlobalRankings();
      await fetchRecentVoters();
    } finally {
      setSaving(false);
    }
  }

  async function handleStartOver() {
    if (!userId) return;
    await supabase.from("user_attribute_ranks").delete().eq("user_id", userId).eq("topic_id", topic.id);
    await supabase.from("user_subject_scores").delete().eq("user_id", userId).eq("topic_id", topic.id);
    setRankedAttributeIds(attributes.map((a) => a.id));
    setSelectedSubjectIds(new Set(subjects.map((s) => s.id)));
    setScores(() => {
      const reset: Record<string, Record<string, number>> = {};
      for (const subject of subjects) {
        reset[subject.id] = {};
        for (const attr of attributes) {
          reset[subject.id][attr.id] = 50;
        }
      }
      return reset;
    });
    setCurrentSubjectIdx(0);
    setCurrentAttrIdx(0);
    setStep("rank");
    setConfirmingReset(false);
    window.scrollTo(0, 0);
  }

  function updateScore(subjectId: string, attributeId: string, value: number) {
    setScores((prev) => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        [attributeId]: value,
      },
    }));
  }

  const openPip = useCallback((url: string, type: "photo" | "music" | "video") => {
    setPipContent({ url, type });
  }, []);

  // Close share menu on outside click
  useEffect(() => {
    if (!shareMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const activeRef = shareMenuOpen === "top" ? shareMenuTopRef : shareMenuBottomRef;
      if (activeRef.current && !activeRef.current.contains(e.target as Node)) {
        setShareMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareMenuOpen]);

  const listUrl = username && topic.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/list/${username}/${topic.slug}`
    : null;

  const handleDownloadCard = async () => {
    const el = document.getElementById("share-card");
    if (!el) return;
    const { default: html2canvas } = await import("html2canvas") as { default: typeof html2canvasType };
    const canvas = await html2canvas(el, {
      width: 1080,
      height: 1080,
      scale: 1,
      useCORS: true,
      backgroundColor: "#080808",
    });
    const link = document.createElement("a");
    link.download = `top5-${topic.slug ?? "list"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setShareMenuOpen(null);
  };

  const handleCopyLink = async () => {
    if (!listUrl) return;
    await navigator.clipboard.writeText(listUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareDropdownItems = (
    <>
      <button
        onClick={handleDownloadCard}
        className="w-full px-4 py-3 text-left text-sm font-mono text-neutral-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
        </svg>
        Download Card
      </button>
      {listUrl && (
        <button
          onClick={handleCopyLink}
          className="w-full px-4 py-3 text-left text-sm font-mono text-neutral-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
          </svg>
          {linkCopied ? "Copied!" : "Copy Link"}
        </button>
      )}
      {listUrl && (
        <>
          <button
            onClick={() => {
              window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listUrl)}`, "_blank", "noopener");
              setShareMenuOpen(null);
            }}
            className="w-full px-4 py-3 text-left text-sm font-mono text-neutral-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Share to Facebook
          </button>
          <button
            onClick={() => {
              const text = `Check out my TOP 5 for ${topic.title}`;
              window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(listUrl)}`, "_blank", "noopener");
              setShareMenuOpen(null);
            }}
            className="w-full px-4 py-3 text-left text-sm font-mono text-neutral-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share to X (Twitter)
          </button>
          <button
            onClick={() => {
              const text = `Check out my TOP 5 for ${topic.title} ${listUrl}`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
              setShareMenuOpen(null);
            }}
            className="w-full px-4 py-3 text-left text-sm font-mono text-neutral-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Share to WhatsApp
          </button>
        </>
      )}
    </>
  );

  if (!attributes.length || !subjects.length) {
    return (
      <div className="text-center py-16 text-neutral-500">
        <p className="font-body">This topic doesn&apos;t have enough data to vote on yet.</p>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 flex-1 rounded-xl bg-brand-surface border border-brand-border animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-brand-surface border border-brand-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PipPanel content={pipContent} onClose={() => setPipContent(null)} />

      {/* Hot Take PiP Panel */}
      {hotTakeOpen && hotTakeTarget && (
        <div className="fixed right-6 bottom-6 z-[9999] w-[340px] rounded-xl overflow-hidden shadow-2xl border border-neutral-700 bg-neutral-900 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 bg-neutral-800 border-b border-neutral-700">
            <span className="text-xs font-mono text-brand-accent tracking-widest uppercase">
              HOT TAKE — {hotTakeTarget.name}
            </span>
            <button
              onClick={() => setHotTakeOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={hotTakeText}
              onChange={(e) => setHotTakeText(e.target.value.slice(0, 280))}
              placeholder="Drop your hot take..."
              rows={3}
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2 text-sm font-body text-white placeholder-neutral-600 resize-none focus:outline-none focus:border-brand-accent"
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs font-mono ${hotTakeText.length > 260 ? "text-red-400" : "text-neutral-600"}`}>
                {hotTakeText.length}/280
              </span>
              <div className="flex items-center gap-2">
                {hotTakeExistingId && (
                  <button
                    onClick={deleteHotTake}
                    disabled={hotTakeSaving}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={submitHotTake}
                  disabled={hotTakeSaving || !hotTakeText.trim() || hotTakeText.length > 280}
                  className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-brand-accent text-brand-bg hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
                >
                  {hotTakeSaving ? "..." : hotTakeExistingId ? "Update" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step Indicator + Top Share Button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          {(["rank", "select", "score", "results"] as const).map((s, i) => {
            const stepOrder = { rank: 0, select: 1, score: 2, results: 3 } as const;
            const isActive = step === s;
            const isPast = stepOrder[s] < stepOrder[step];

            return (
              <button
                key={s}
                onClick={() => {
                  setStep(s);
                  window.scrollTo(0, 0);
                }}
                className="flex items-center gap-2 flex-1 sm:flex-none"
              >
                <div
                  className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-sm font-mono transition-all w-full sm:w-auto justify-center sm:justify-start ${
                    isActive
                      ? "bg-brand-accent text-brand-bg font-bold"
                      : isPast
                        ? "bg-brand-surface border border-brand-accent/30 text-brand-accent"
                        : "bg-brand-surface border border-brand-border text-neutral-500"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isActive
                        ? "bg-brand-bg text-brand-accent"
                        : isPast
                          ? "bg-brand-accent/20 text-brand-accent"
                          : "bg-brand-border text-neutral-600"
                    }`}
                  >
                    {isPast ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="hidden sm:inline">{STEP_META[s].label}</span>
                </div>
              </button>
            );
          })}
        </div>
        {step === "results" && saved && (
          <div className="relative ml-auto" ref={shareMenuTopRef}>
            <button
              onClick={() => setShareMenuOpen((v) => v === "top" ? null : "top")}
              className="px-4 py-2.5 rounded-xl bg-brand-surface border border-brand-border
                         text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors
                         flex items-center gap-2 whitespace-nowrap"
            >
              Share Your <span className="brand-glow font-bold" style={{ color: "#FFD700" }}>TOP</span>{" "}<span className="brand-glow font-bold" style={{ color: "#FFD700" }}>5</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${shareMenuOpen === "top" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {shareMenuOpen === "top" && (
              <div className="absolute top-full mt-2 right-0 w-56 rounded-xl bg-brand-surface border border-brand-border shadow-xl shadow-black/40 overflow-hidden z-50">
                {shareDropdownItems}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-save indicator + Start Over */}
      {userId && !saved && (
        <div className="flex items-center justify-between -mt-4">
          <div className="text-xs font-mono">
            {confirmingReset ? (
              <span className="flex items-center gap-2">
                <span className="text-neutral-500">Reset all progress?</span>
                <button
                  onClick={() => setConfirmingReset(false)}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartOver}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  Yes, reset
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingReset(true)}
                className="text-neutral-700 hover:text-neutral-500 transition-colors"
              >
                Start Over
              </button>
            )}
          </div>
          {autoSaveStatus !== "idle" && (
            <span className="text-xs font-mono text-neutral-600">
              {autoSaveStatus === "saving"
                ? "Saving..."
                : "✓ Progress saved — pick up where you left off anytime"}
            </span>
          )}
        </div>
      )}

      {/* Step 1: Rank Attributes */}
      {step === "rank" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-3xl tracking-wide">RANK THE ATTRIBUTES</h2>
            <p className="text-neutral-500 text-sm mt-1 font-body">
              Drag to reorder by importance. #1 carries the most weight.
            </p>
          </div>

          <AttributeRanker
            attributes={rankedAttributes}
            weights={weights}
            onReorder={setRankedAttributeIds}
          />

          <div className="flex justify-end pt-2">
            <button
              onClick={() => { setStep("select"); window.scrollTo(0, 0); }}
              className="px-8 py-3.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold
                         hover:bg-brand-accent/90 transition-colors"
            >
              Next: Select Subjects
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Subjects */}
      {step === "select" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-3xl tracking-wide">SELECT SUBJECTS TO SCORE</h2>
            <p className="text-neutral-500 text-sm mt-1 font-body">
              Choose which subjects you want to score. You must select at least {MIN_SELECTED_SUBJECTS}.
            </p>
          </div>

          {/* Select All toggle + counter */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (selectedSubjectIds.size === subjects.length) {
                  setSelectedSubjectIds(new Set());
                } else {
                  setSelectedSubjectIds(new Set(subjects.map((s) => s.id)));
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-surface border border-brand-border text-sm font-mono hover:border-neutral-600 transition-colors"
            >
              <span
                className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                  selectedSubjectIds.size === subjects.length
                    ? "bg-brand-accent border-brand-accent text-brand-bg"
                    : "border-neutral-600"
                }`}
              >
                {selectedSubjectIds.size === subjects.length && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="text-neutral-300">Select All</span>
            </button>
            <span
              className={`text-sm font-mono ${
                selectedSubjectIds.size >= MIN_SELECTED_SUBJECTS
                  ? "text-brand-accent"
                  : "text-neutral-500"
              }`}
            >
              {selectedSubjectIds.size}/{MIN_SELECTED_SUBJECTS} minimum selected
            </span>
          </div>

          {/* Subject checklist */}
          <div className="space-y-2">
            {subjects.map((subject) => {
              const isSelected = selectedSubjectIds.has(subject.id);
              return (
                <button
                  key={subject.id}
                  onClick={() => {
                    setSelectedSubjectIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(subject.id)) {
                        next.delete(subject.id);
                      } else {
                        next.add(subject.id);
                      }
                      return next;
                    });
                  }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
                    isSelected
                      ? "bg-brand-surface border-brand-accent/40"
                      : "bg-brand-surface border-brand-border hover:border-neutral-600"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                      isSelected
                        ? "bg-brand-accent border-brand-accent text-brand-bg"
                        : "border-neutral-600"
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  {subject.link_photo && !subject.link_photo.includes("google.com/search") && (
                    <img
                      src={subject.link_photo}
                      alt={subject.name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono text-neutral-200 uppercase tracking-wider">
                      {subject.name}
                    </p>
                    {subject.era && (
                      <p className="text-xs font-mono text-neutral-600">{subject.era}</p>
                    )}
                  </div>
                  {userId && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openHotTake("subject", subject.id, subject.name); }}
                      className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/40 transition-colors"
                    >
                      HOT TAKE
                    </button>
                  )}
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => { setStep("rank"); window.scrollTo(0, 0); }}
              className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                         text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
            >
              Back to Ranking
            </button>
            <button
              onClick={() => { setCurrentSubjectIdx(0); setCurrentAttrIdx(0); setStep("score"); window.scrollTo(0, 0); }}
              disabled={selectedSubjectIds.size < MIN_SELECTED_SUBJECTS}
              className={`px-8 py-3.5 rounded-xl font-mono font-bold transition-colors ${
                selectedSubjectIds.size >= MIN_SELECTED_SUBJECTS
                  ? "bg-brand-accent text-brand-bg hover:bg-brand-accent/90"
                  : "bg-neutral-700 text-neutral-500 cursor-not-allowed"
              }`}
            >
              Next: Score Subjects
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Score Subjects */}
      {step === "score" && (
        <div className="space-y-6">
          {/* Mode toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider hidden sm:inline">
              Mode:
            </span>
            <div className="flex items-center p-1 rounded-xl bg-brand-surface border border-brand-border gap-1">
              <button
                onClick={() => setVoteMode("by-subject")}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-colors ${
                  voteMode === "by-subject"
                    ? "bg-brand-accent text-brand-bg"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                BY SUBJECT
              </button>
              <button
                onClick={() => setVoteMode("by-attribute")}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-colors ${
                  voteMode === "by-attribute"
                    ? "bg-brand-accent text-brand-bg"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                BY ATTRIBUTE
              </button>
            </div>
            <span className="text-xs font-mono text-neutral-600 hidden sm:inline">
              {voteMode === "by-subject"
                ? "Score all attributes for one subject at a time"
                : "Compare all subjects side-by-side for one attribute"}
            </span>
          </div>

          {/* ── BY SUBJECT mode ── */}
          {voteMode === "by-subject" && currentSubject && (
            <>
              {/* Subject header card */}
              <div className="flex items-center justify-between p-5 rounded-2xl bg-brand-surface border border-brand-border">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-3xl tracking-wide">
                      {currentSubject.name.toUpperCase()}
                    </h2>
                    <SubjectLinks subject={currentSubject} topicTitle={topic.title} onOpen={openPip} />
                    {userId && (
                      <button
                        type="button"
                        onClick={() => openHotTake("subject", currentSubject.id, currentSubject.name)}
                        className="px-2 py-1 rounded-md text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/40 transition-colors"
                      >
                        HOT TAKE
                      </button>
                    )}
                  </div>
                  {currentSubject.era && (
                    <p className="text-neutral-500 text-sm font-mono mt-1">{currentSubject.era}</p>
                  )}
                  {currentSubject.description && (
                    <p className="text-sm text-neutral-400 break-words mt-1">{currentSubject.description}</p>
                  )}
                  <p className="text-neutral-600 text-xs font-mono mt-1">
                    Subject {currentSubjectIdx + 1} of {selectedSubjects.length}
                  </p>
                </div>

                {/* Subject stats */}
                {currentSubject.stats && (
                  <div className="hidden sm:flex items-center gap-3">
                    {Object.entries(currentSubject.stats as Record<string, number>).slice(0, 4).map(([key, val]) => (
                      <div key={key} className="text-center px-3 py-2 rounded-lg bg-brand-bg border border-brand-border">
                        <p className="text-xs font-mono text-neutral-600 uppercase">{key}</p>
                        <p className="text-sm font-mono font-bold text-white">{val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attribute sliders */}
              <div className="space-y-6">
                {rankedAttributes.map((attr, idx) => (
                  <div key={attr.id} className="p-4 rounded-xl bg-brand-surface border border-brand-border space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold font-mono ${
                          idx === 0
                            ? "bg-brand-accent/20 text-brand-accent"
                            : "bg-brand-border text-neutral-500"
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm font-mono text-neutral-300 uppercase tracking-wider">
                          {attr.name}
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-neutral-600">
                          {weights[idx] ?? 0}% weight
                        </span>
                        {userId && (
                          <button
                            type="button"
                            onClick={() => openHotTake("attribute", attr.id, attr.name)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/40 transition-colors"
                          >
                            HOT TAKE
                          </button>
                        )}
                      </div>
                    </div>
                    <SubjectScoreSlider
                      value={scores[currentSubject.id]?.[attr.id] ?? 50}
                      onChange={(v) => updateScore(currentSubject.id, attr.id, v)}
                    />
                  </div>
                ))}
              </div>

              {/* Subject Navigation */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => {
                    if (currentSubjectIdx > 0) {
                      setCurrentSubjectIdx(currentSubjectIdx - 1);
                      window.scrollTo(0, 0);
                    } else {
                      setStep("select");
                      window.scrollTo(0, 0);
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                             text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
                >
                  {currentSubjectIdx > 0 ? "Previous" : "Back to Selection"}
                </button>

                {/* Dot nav */}
                <div className="flex gap-1.5">
                  {selectedSubjects.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setCurrentSubjectIdx(i); window.scrollTo(0, 0); }}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        i === currentSubjectIdx
                          ? "bg-brand-accent"
                          : "bg-brand-border hover:bg-neutral-500"
                      }`}
                      aria-label={`Go to subject ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (currentSubjectIdx < selectedSubjects.length - 1) {
                      setCurrentSubjectIdx(currentSubjectIdx + 1);
                      window.scrollTo(0, 0);
                    } else {
                      setStep("results");
                      window.scrollTo(0, 0);
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                             hover:bg-brand-accent/90 transition-colors"
                >
                  {currentSubjectIdx < selectedSubjects.length - 1 ? "Next Subject" : "See Results"}
                </button>
              </div>
            </>
          )}

          {/* ── BY ATTRIBUTE mode ── */}
          {voteMode === "by-attribute" && currentAttr && (
            <>
              {/* Attribute header card */}
              <div className="p-5 rounded-2xl bg-brand-surface border border-brand-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold font-mono flex-shrink-0 ${
                      currentAttrIdx === 0
                        ? "bg-brand-accent/20 text-brand-accent"
                        : "bg-brand-border text-neutral-500"
                    }`}>
                      {currentAttrIdx + 1}
                    </span>
                    <div>
                      <h2 className="font-display text-3xl tracking-wide">
                        {currentAttr.name.toUpperCase()}
                      </h2>
                      {currentAttr.description && (
                        <p className="text-neutral-500 text-sm font-body mt-1 break-words">{currentAttr.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {userId && (
                      <button
                        type="button"
                        onClick={() => openHotTake("attribute", currentAttr.id, currentAttr.name)}
                        className="px-2 py-1 rounded-md text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/40 transition-colors"
                      >
                        HOT TAKE
                      </button>
                    )}
                    <div className="text-right">
                      <p className="text-xs font-mono text-neutral-600">
                        Attribute {currentAttrIdx + 1} of {rankedAttributes.length}
                      </p>
                      <p className="text-sm font-mono font-bold text-brand-accent mt-0.5">
                        {weights[currentAttrIdx] ?? 0}% weight
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* All selected subjects as sliders for this attribute */}
              <div className="space-y-4">
                {selectedSubjects.map((subject) => (
                  <div key={subject.id} className="p-4 rounded-xl bg-brand-surface border border-brand-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-mono text-neutral-300 uppercase tracking-wider">
                            {subject.name}
                          </p>
                          <SubjectLinks subject={subject} topicTitle={topic.title} onOpen={openPip} />
                        </div>
                        {subject.era && (
                          <p className="text-xs font-mono text-neutral-600">{subject.era}</p>
                        )}
                        {subject.description && (
                          <p className="text-sm text-neutral-400 break-words mt-0.5">{subject.description}</p>
                        )}
                      </div>
                      {userId && (
                        <button
                          type="button"
                          onClick={() => openHotTake("subject", subject.id, subject.name)}
                          className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/40 transition-colors"
                        >
                          HOT TAKE
                        </button>
                      )}
                    </div>
                    <SubjectScoreSlider
                      value={scores[subject.id]?.[currentAttr.id] ?? 50}
                      onChange={(v) => updateScore(subject.id, currentAttr.id, v)}
                    />
                  </div>
                ))}
              </div>

              {/* Attribute Navigation */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => {
                    if (currentAttrIdx > 0) {
                      setCurrentAttrIdx(currentAttrIdx - 1);
                      window.scrollTo(0, 0);
                    } else {
                      setStep("select");
                      window.scrollTo(0, 0);
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                             text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
                >
                  {currentAttrIdx > 0 ? "Previous" : "Back to Selection"}
                </button>

                {/* Dot nav for attributes */}
                <div className="flex gap-1.5">
                  {rankedAttributes.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setCurrentAttrIdx(i); window.scrollTo(0, 0); }}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        i === currentAttrIdx
                          ? "bg-brand-accent"
                          : "bg-brand-border hover:bg-neutral-500"
                      }`}
                      aria-label={`Go to attribute ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (currentAttrIdx < rankedAttributes.length - 1) {
                      setCurrentAttrIdx(currentAttrIdx + 1);
                      window.scrollTo(0, 0);
                    } else {
                      setStep("results");
                      window.scrollTo(0, 0);
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                             hover:bg-brand-accent/90 transition-colors"
                >
                  {currentAttrIdx < rankedAttributes.length - 1 ? "Next Attribute" : "See Results"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Results */}
      {step === "results" && (
        <div className="space-y-6">
          {saved ? (
            /* ── Post-save: two-column locked-in view ── */
            <>
              {/* Main content + sidebar layout */}
              <div className="flex flex-col lg:flex-row lg:gap-6">
              {/* Main content area */}
              <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-3xl tracking-wide">LIST LOCKED IN</h2>
                  <p className="text-neutral-500 text-sm mt-1 font-body">
                    Your vote has been counted
                  </p>
                  <p className="text-xs font-mono text-neutral-600 mt-1">
                    {voterCount.toLocaleString()} {voterCount === 1 ? "voter" : "voters"} on this topic
                  </p>
                  <p className="text-xs italic text-neutral-600 mt-1 font-body">
                    Scores reflect ranking within this topic only.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {username && (
                    <ShareButton
                      title={`My ${topic.title} Top 5`}
                      path={`/topics/${topic.slug}`}
                      listUrl={`/list/${username}/${topic.slug}`}
                    />
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-mono font-bold">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    LOCKED
                  </span>
                </div>
              </div>

              {/* Two-column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: personal list */}
                <div className="space-y-3">
                  <h3 className="font-display text-lg tracking-wide text-neutral-300">
                    {displayName ? `${displayName}'s List` : "YOUR LIST"}
                  </h3>
                  {(isPremium ? results : results.slice(0, 5)).map((r, idx) => {
                    const isGold = idx === 0;
                    const isSilver = idx === 1;
                    const isBronze = idx === 2;
                    return (
                      <div
                        key={r.subject.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isGold ? "bg-brand-accent/5 border-brand-accent/40" : "bg-brand-surface border-brand-border"
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-base flex-shrink-0 ${
                          isGold ? "bg-brand-accent/20 text-brand-accent"
                          : isSilver ? "bg-neutral-400/20 text-neutral-300"
                          : isBronze ? "bg-orange-500/20 text-orange-400"
                          : "bg-brand-border text-neutral-600"
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className={`font-display text-sm tracking-wide truncate flex-1 min-w-0 ${isGold ? "text-brand-accent" : "text-white"}`}>
                              {r.subject.name.toUpperCase()}
                            </p>
                            <SubjectLinks subject={r.subject} topicTitle={topic.title} onOpen={openPip} />
                          </div>
                          {r.subject.era && (
                            <p className="text-xs font-mono text-neutral-600">{r.subject.era}</p>
                          )}
                        </div>
                        <p className={`font-mono font-bold text-sm flex-shrink-0 ${isGold ? "text-brand-accent" : "text-neutral-400"}`}>
                          {r.score.toFixed(1)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Right: community tally */}
                <div className="space-y-3">
                  <h3 className="font-display text-lg tracking-wide text-neutral-300">HOW THE WORLD RANKED IT</h3>
                  {globalLoading || globalRankings === null ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-brand-surface border border-brand-border animate-pulse" />
                      ))}
                    </div>
                  ) : globalRankings.length === 0 ? (
                    <p className="text-neutral-500 text-sm font-mono py-6 text-center">
                      No community votes yet.<br />You&apos;re among the first!
                    </p>
                  ) : (
                    <>
                      {/* Global #1 — always visible */}
                      {globalRankings[0] && (() => {
                        const r = globalRankings[0];
                        return (
                          <div
                            key={r.subject.id}
                            className="flex items-center gap-3 p-3 rounded-xl border transition-all bg-brand-accent/5 border-brand-accent/40"
                          >
                            <span className="w-8 h-8 rounded-full flex items-center justify-center font-display text-base flex-shrink-0 bg-brand-accent/20 text-brand-accent">
                              1
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="font-display text-sm tracking-wide truncate flex-1 min-w-0 text-brand-accent">
                                  {r.subject.name.toUpperCase()}
                                </p>
                                <SubjectLinks subject={r.subject} topicTitle={topic.title} onOpen={openPip} />
                              </div>
                              {r.subject.era && (
                                <p className="text-xs font-mono text-neutral-600">{r.subject.era}</p>
                              )}
                            </div>
                            <p className="font-mono font-bold text-sm flex-shrink-0 text-brand-accent">
                              {r.score.toFixed(1)}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Global positions 2+: blurred for free users, fully visible for premium */}
                      {globalRankings.slice(1, isPremium ? undefined : 5).length > 0 && (
                        <div className="relative">
                          <div className={!isPremium ? "blur-sm pointer-events-none select-none" : ""}>
                            <div className="space-y-3">
                              {globalRankings.slice(1, isPremium ? undefined : 5).map((r, relIdx) => {
                                const idx = relIdx + 1;
                                const isSilver = idx === 1;
                                const isBronze = idx === 2;
                                return (
                                  <div
                                    key={r.subject.id}
                                    className="flex items-center gap-3 p-3 rounded-xl border transition-all bg-brand-surface border-brand-border"
                                  >
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-base flex-shrink-0 ${
                                      isSilver ? "bg-neutral-400/20 text-neutral-300"
                                      : isBronze ? "bg-orange-500/20 text-orange-400"
                                      : "bg-brand-border text-neutral-600"
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <p className="font-display text-sm tracking-wide truncate flex-1 min-w-0 text-white">
                                          {r.subject.name.toUpperCase()}
                                        </p>
                                        <SubjectLinks subject={r.subject} topicTitle={topic.title} onOpen={openPip} />
                                      </div>
                                      {r.subject.era && (
                                        <p className="text-xs font-mono text-neutral-600">{r.subject.era}</p>
                                      )}
                                    </div>
                                    <p className="font-mono font-bold text-sm flex-shrink-0 text-neutral-400">
                                      {r.score.toFixed(1)}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {!isPremium && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-brand-bg/70">
                              <p className="font-display text-base tracking-wide text-white text-center px-4">
                                Upgrade to see the full rankings
                              </p>
                              <a
                                href="/signup"
                                className="px-6 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm hover:bg-brand-accent/90 transition-colors"
                              >
                                Unlock Full Rankings
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              </div>{/* end main content area */}

              {/* Recent Voters sidebar — desktop: right side panel, mobile: below results */}
              {recentVoters.length >= 2 && (
                <div className="mt-6 lg:mt-0 w-full lg:w-[240px] lg:flex-shrink-0">
                  <div className="lg:sticky lg:top-[113px] rounded-xl border border-brand-border bg-brand-surface p-4">
                    <h3 className="font-display text-xs tracking-[0.2em] text-neutral-500 mb-3 px-1">
                      RECENT VOTERS
                    </h3>
                    <ol className="flex flex-col gap-0.5">
                      {recentVoters.map((voter) => {
                        const initials = (voter.display_name ?? voter.username)
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((w) => w[0]?.toUpperCase() ?? "")
                          .join("");
                        return (
                          <li key={voter.username}>
                            <Link
                              href={`/profile/${voter.username}`}
                              className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors duration-150 group"
                            >
                              {voter.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={voter.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <span className="w-7 h-7 rounded-full bg-brand-border flex items-center justify-center text-[10px] font-mono text-neutral-400 flex-shrink-0">
                                  {initials}
                                </span>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-body text-neutral-300 truncate group-hover:text-[#e8ff00] transition-colors duration-150">
                                  {voter.username}
                                </p>
                                {voter.topPick && (
                                  <p className="text-xs font-mono text-neutral-600 mt-0.5 truncate">
                                    #1 {voter.topPick}
                                  </p>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>
              )}
              </div>{/* end flex row */}

              {/* Share card — hidden off-screen, captured by html2canvas */}
              {/* Layout matches mockup v1 exactly, scaled 2× to 1080px */}
              <div
                id="share-card"
                style={{
                  position: "fixed",
                  left: "-9999px",
                  top: 0,
                  width: "1080px",
                  height: "1080px",
                  backgroundColor: "#080808",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxSizing: "border-box",
                  fontFamily: "'DM Sans', sans-serif",
                  contain: "layout",
                }}
              >
                {/* Top accent bar */}
                <div style={{
                  height: "6px",
                  background: "linear-gradient(90deg, #e8ff00 0%, #e8ff00 60%, transparent 100%)",
                  width: "100%",
                  flexShrink: 0,
                }} />

                {/* Header: brand + category chip */}
                <div style={{
                  padding: "40px 48px 32px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexShrink: 0,
                }}>
                  <div style={{
                    fontFamily: "'Bebas Neue', Impact, sans-serif",
                    fontSize: "44px",
                    letterSpacing: "4px",
                    color: "#ffffff",
                    lineHeight: 1,
                  }}>
                    TOP5 <span style={{ color: "#e8ff00" }}>DOA</span>
                  </div>
                  {topic.category?.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {topic.category.map((cat) => (
                        <div key={cat} style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          background: "rgba(232,255,0,0.08)",
                          border: "1px solid rgba(232,255,0,0.3)",
                          borderRadius: "8px",
                          padding: "8px 20px",
                          fontFamily: "'Space Mono', monospace",
                          fontSize: "18px",
                          color: "#e8ff00",
                          letterSpacing: "4px",
                          textTransform: "uppercase",
                        }}>
                          ● {cat}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Topic section */}
                <div style={{
                  padding: "0 48px 40px",
                  borderBottom: "1px solid #161616",
                  flexShrink: 0,
                }}>
                  <div style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "18px",
                    color: "#444444",
                    letterSpacing: "4px",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                  }}>
                    My Top 5
                  </div>
                  <div style={{
                    fontFamily: "'Bebas Neue', Impact, sans-serif",
                    fontSize: "52px",
                    color: "#ffffff",
                    lineHeight: 1.15,
                    letterSpacing: "2px",
                    wordBreak: "break-word",
                    minHeight: "120px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {topic.title.toUpperCase()}
                  </div>
                </div>

                {/* Rankings */}
                <div style={{
                  padding: "36px 48px 160px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  flex: 1,
                }}>
                  {(() => {
                    const top5 = results.slice(0, 5);
                    // HSL gradient: green (120) → yellow-green (80) → yellow (55) → orange (30) → red (0)
                    const hslColors = [
                      "hsl(120, 85%, 45%)",
                      "hsl(80, 85%, 45%)",
                      "hsl(55, 90%, 50%)",
                      "hsl(30, 95%, 50%)",
                      "hsl(0, 85%, 50%)",
                    ];
                    return top5.map((r, idx) => {
                      const color = hslColors[idx] ?? "hsl(0, 85%, 50%)";
                      const fillWidth = Math.min(100, Math.round(r.score));
                      return (
                        <div key={r.subject.id} style={{ display: "flex", alignItems: "center", gap: "28px" }}>
                          {/* Rank number */}
                          <div style={{
                            fontFamily: "'Bebas Neue', Impact, sans-serif",
                            fontSize: "26px",
                            width: "44px",
                            textAlign: "center",
                            color: color,
                            flexShrink: 0,
                          }}>
                            {idx + 1}
                          </div>
                          {/* Bar */}
                          <div style={{
                            flex: 1,
                            height: "72px",
                            borderRadius: "12px",
                            background: "#111111",
                            border: `1px solid rgba(255,255,255,0.07)`,
                            position: "relative",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            padding: "0 28px",
                          }}>
                            {/* Score fill */}
                            <div style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              height: "100%",
                              width: `${fillWidth}%`,
                              backgroundColor: color,
                              opacity: 0.15,
                              borderRadius: "12px",
                            }} />
                            {/* Subject name */}
                            <span style={{
                              position: "relative",
                              fontFamily: "'Space Mono', monospace",
                              fontSize: "22px",
                              color: idx === 0 ? "#ffffff" : "#e5e5e5",
                              fontWeight: idx === 0 ? 700 : 400,
                              letterSpacing: "1px",
                              flex: 1,
                            }}>
                              {r.subject.name.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Footer — absolutely anchored to the bottom so long titles can't push it off */}
                <div style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "32px 48px",
                  background: "linear-gradient(0deg, #080808 80%, transparent)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {displayName && (
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "26px",
                        fontWeight: 600,
                        color: "#ffffff",
                        lineHeight: 1.2,
                      }}>
                        {displayName}
                      </span>
                    )}
                    {username && (
                      <span style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "20px",
                        color: "#555555",
                      }}>
                        @{username}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      display: "block",
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "18px",
                      color: "#444444",
                      letterSpacing: "2px",
                      marginBottom: "6px",
                    }}>
                      Make your list at
                    </span>
                    <span style={{
                      fontFamily: "'Bebas Neue', Impact, sans-serif",
                      fontSize: "28px",
                      color: "#e8ff00",
                      letterSpacing: "2px",
                    }}>
                      TOP5DOA.APP
                    </span>
                  </div>
                </div>
              </div>

              {/* Edit Vote button */}
              <div className="flex justify-start gap-3 pt-2">
                <button
                  onClick={() => {
                    setSaved(false);
                    setCurrentSubjectIdx(0);
                    setStep("rank");
                    window.scrollTo(0, 0);
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                             text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
                >
                  Edit Vote
                </button>
                <div className="relative" ref={shareMenuBottomRef} id="share-menu-anchor">
                  <button
                    onClick={() => setShareMenuOpen((v) => v === "bottom" ? null : "bottom")}
                    className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                               text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors
                               flex items-center gap-2"
                  >
                    Share Your <span className="brand-glow font-bold" style={{ color: "#FFD700" }}>TOP</span>{" "}<span className="brand-glow font-bold" style={{ color: "#FFD700" }}>5</span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${shareMenuOpen === "bottom" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {shareMenuOpen === "bottom" && (
                    <div className="absolute bottom-full mb-2 right-0 w-56 rounded-xl bg-brand-surface border border-brand-border shadow-xl shadow-black/40 overflow-hidden z-50">
                      {shareDropdownItems}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* ── Pre-save: single-column preview ── */
            <>
              <div>
                <h2 className="font-display text-3xl tracking-wide">YOUR TOP 5</h2>
                <p className="text-neutral-500 text-sm mt-1 font-body">
                  Based on your attribute rankings and scores
                </p>
                <p className="text-xs italic text-neutral-600 mt-1 font-body">
                  Scores reflect ranking within this topic only.
                </p>
              </div>

              <div className="space-y-3">
                {/* Position #1 — always visible */}
                {results[0] && (
                  <div className="flex items-center gap-4 p-4 rounded-xl border transition-all bg-brand-accent/5 border-brand-accent/40">
                    <span className="w-10 h-10 rounded-full flex items-center justify-center font-display text-xl flex-shrink-0 bg-brand-accent/20 text-brand-accent">
                      1
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-display text-lg tracking-wide truncate flex-1 min-w-0 text-brand-accent">
                          {results[0].subject.name.toUpperCase()}
                        </p>
                        <SubjectLinks subject={results[0].subject} topicTitle={topic.title} onOpen={openPip} />
                      </div>
                      {results[0].subject.era && (
                        <p className="text-xs font-mono text-neutral-600">{results[0].subject.era}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold text-lg text-brand-accent">
                        {results[0].score.toFixed(1)}
                      </p>
                      <p className="text-xs font-mono text-neutral-600">pts</p>
                    </div>
                  </div>
                )}

                {/* Positions 2–5: blurred for unauthenticated users */}
                {results.slice(1, 5).length > 0 && (
                  <div className="relative">
                    <div className={!userId ? "blur-sm pointer-events-none select-none" : ""}>
                      <div className="space-y-3">
                        {results.slice(1, 5).map((r, relIdx) => {
                          const idx = relIdx + 1;
                          const isSilver = idx === 1;
                          const isBronze = idx === 2;
                          return (
                            <div
                              key={r.subject.id}
                              className="flex items-center gap-4 p-4 rounded-xl border transition-all bg-brand-surface border-brand-border"
                            >
                              <span className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-xl flex-shrink-0 ${
                                isSilver ? "bg-neutral-400/20 text-neutral-300"
                                : isBronze ? "bg-orange-500/20 text-orange-400"
                                : "bg-brand-border text-neutral-600"
                              }`}>
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="font-display text-lg tracking-wide truncate flex-1 min-w-0 text-white">
                                    {r.subject.name.toUpperCase()}
                                  </p>
                                  <SubjectLinks subject={r.subject} topicTitle={topic.title} onOpen={openPip} />
                                </div>
                                {r.subject.era && (
                                  <p className="text-xs font-mono text-neutral-600">{r.subject.era}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-mono font-bold text-lg text-white">
                                  {r.score.toFixed(1)}
                                </p>
                                <p className="text-xs font-mono text-neutral-600">pts</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {!userId && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-brand-bg/70">
                        <p className="font-display text-lg tracking-wide text-white text-center px-4">
                          Sign in to see your full Top 5
                        </p>
                        <a
                          href="/signup"
                          className="px-6 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm hover:bg-brand-accent/90 transition-colors"
                        >
                          Sign Up
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => {
                    setCurrentSubjectIdx(0);
                    setStep("score");
                    window.scrollTo(0, 0);
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                             text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
                >
                  Edit Scores
                </button>

                {userId ? (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-3.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                               hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Lock In My List"}
                  </button>
                ) : (
                  <a
                    href="/login"
                    className="px-8 py-3.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                               hover:bg-brand-accent/90 transition-colors inline-block"
                  >
                    Sign In to Save
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
