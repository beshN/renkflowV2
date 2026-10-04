"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  MessageSquare,
  Clock,
  User,
  ChevronDown,
  Loader2,
  File as FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/context/AuthContext";
import { hasPermission } from "@/lib/auth/permissions";

// ============================================
// Types
// ============================================

export interface ActivityLog {
  id: string;
  action: string;
  actorName: string | null;
  actorId: string | null;
  note: string | null;
  changes: Record<string, { from: string; to: string }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChatterProps {
  entityType: string;
  entityId: string;
  tenantId?: string;
  className?: string;
  maxHeight?: string;
}

// ============================================
// Action label map
// ============================================

const ACTION_LABELS: Record<
  string,
  { label: string; emoji: string; color: string }
> = {
  created: {
    label: "oluşturuldu",
    emoji: "✨",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  status_changed: {
    label: "durumu değiştirildi",
    emoji: "🔄",
    color: "text-sky-600 dark:text-sky-400",
  },
  note_added: {
    label: "not ekledi",
    emoji: "💬",
    color: "text-violet-600 dark:text-violet-400",
  },
  file_uploaded: {
    label: "dosya yükledi",
    emoji: "📎",
    color: "text-amber-600 dark:text-amber-400",
  },
  field_updated: {
    label: "güncelledi",
    emoji: "✏️",
    color: "text-neutral-600 dark:text-neutral-400",
  },
  assigned: {
    label: "atandı",
    emoji: "👤",
    color: "text-indigo-600 dark:text-indigo-400",
  },
  deleted: {
    label: "silindi",
    emoji: "🗑️",
    color: "text-rose-600 dark:text-rose-400",
  },
  approved: {
    label: "onaylandı",
    emoji: "✅",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  rejected: {
    label: "reddedildi",
    emoji: "❌",
    color: "text-rose-600 dark:text-rose-400",
  },
};

// ============================================
// Activity Item
// ============================================

function ActivityItem({ log }: { log: ActivityLog }) {
  const actionMeta = ACTION_LABELS[log.action] || {
    label: log.action,
    emoji: "•",
    color: "text-muted-foreground",
  };

  const renderChanges = () => {
    if (!log.changes || Object.keys(log.changes).length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(log.changes).map(([field, change]) => (
          <div
            key={field}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-xs"
          >
            <span className="font-medium text-muted-foreground">{field}:</span>
            <span className="text-rose-500 dark:text-rose-400 line-through">
              {change.from || "—"}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {change.to || "—"}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
        {log.actorName ? log.actorName[0].toUpperCase() : "S"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-sm font-semibold text-foreground">
            {log.actorName || "Sistem"}
          </span>
          <span className={cn("text-xs font-medium", actionMeta.color)}>
            {actionMeta.emoji} {actionMeta.label}
          </span>
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
            <Clock size={10} />
            {formatDate(log.createdAt)}
          </span>
        </div>

        {log.note && (
          <div className="mt-1.5 rounded-xl rounded-tl-sm border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-foreground">
            {log.note}
          </div>
        )}

        {renderChanges()}
      </div>
    </div>
  );
}

// ============================================
// Chatter Component
// ============================================

export function Chatter({
  entityType,
  entityId,
  tenantId,
  className,
  maxHeight = "420px",
}: ChatterProps) {
  const { user } = useAuth();
  const canAddNote = Boolean(
    user &&
    hasPermission(
      user.role,
      entityType === "customer" ? "customers.edit" : "orders.edit",
    ),
  );
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/v1/activity-logs?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      );
      if (!res.ok) throw new Error("Aktivite yüklenemedi");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError("Aktivite geçmişi yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) loadLogs();
  }, [entityId, entityType]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSendNote = async () => {
    const trimmed = note.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/v1/activity-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          action: "note_added",
          note: trimmed,
        }),
      });
      if (!res.ok) throw new Error("Not gönderilemedi");
      setNote("");
      await loadLogs();
    } catch (err) {
      setError("Not gönderilemedi. Lütfen tekrar deneyin.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendNote();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/50">
        <MessageSquare size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Aktivite ve Notlar
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {logs.length} kayıt
        </span>
      </div>

      {/* Logs */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800"
        style={{ maxHeight }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <MessageSquare size={16} className="text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Henüz aktivite yok
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Bu kayıttaki durum değişiklikleri ve notlar burada görünecek.
            </p>
          </div>
        ) : (
          logs.map((log) => <ActivityItem key={log.id} log={log} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="px-4 py-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-t border-rose-100 dark:border-rose-900/30"
        >
          {error}
        </div>
      )}

      {/* Note Input */}
      {canAddNote && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 p-3">
          <div className="flex gap-2 items-end">
            <textarea
              aria-label="Aktivite notu"
              maxLength={2000}
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Not ekle... (Ctrl+Enter ile gönder)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:bg-white dark:focus:bg-neutral-950 focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              aria-label="Notu gönder"
              onClick={handleSendNote}
              disabled={!note.trim() || isSending}
              className="flex-shrink-0 h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              {isSending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Not eklemek için yazın. Ctrl+Enter ile gönderin.
          </p>
        </div>
      )}
    </div>
  );
}
