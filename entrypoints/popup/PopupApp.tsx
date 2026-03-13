import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface PopupStateResponse {
  trackedCount: number
  isCurrentTabPr: boolean
  isCurrentTabTracked: boolean
  currentPrUrl: string | null
  trackedPrItems: TrackedPrItem[]
}

interface TrackedPrItem {
  prUrl: string
  state: "working" | "reviewing" | "merge_waiting" | "merged"
  updatedAt: number
  title: string | null
  conversationTabCount: number
  otherViewTabCount: number
  isConversationOpen: boolean
}

interface RegisterResponse {
  ok: boolean
  reason?: "not_pr_page" | "already_tracked"
  trackedCount: number
  prUrl?: string
}

interface UntrackResponse {
  ok: boolean
  reason?: "not_pr_page" | "not_tracked"
  trackedCount: number
  prUrl?: string
}

interface ReloadTrackedPrsResponse {
  ok: boolean
  reloadedTabCount: number
}

interface UiStatus {
  tone: "neutral" | "success" | "warn"
  message: string
}

interface ModuleSettings {
  githubPrManager: { enabled: boolean }
}

interface ExtensionApiLike {
  runtime?: {
    sendMessage: (message: unknown) => Promise<any>
  }
}

const extensionApi = (globalThis as { chrome?: ExtensionApiLike }).chrome;

async function fetchPopupState(): Promise<PopupStateResponse> {
  if (!extensionApi?.runtime) {
    return {
      trackedCount: 0,
      isCurrentTabPr: false,
      isCurrentTabTracked: false,
      currentPrUrl: null,
      trackedPrItems: [],
    };
  }

  const response = await extensionApi.runtime.sendMessage({ type: "GET_POPUP_STATE" }) as Partial<PopupStateResponse>;

  return {
    trackedCount: typeof response.trackedCount === "number" ? response.trackedCount : 0,
    isCurrentTabPr: Boolean(response.isCurrentTabPr),
    isCurrentTabTracked: Boolean(response.isCurrentTabTracked),
    currentPrUrl: typeof response.currentPrUrl === "string" ? response.currentPrUrl : null,
    trackedPrItems: Array.isArray(response.trackedPrItems)
      ? response.trackedPrItems.map(item => ({
          ...item,
          title: typeof item.title === "string" ? item.title : null,
          conversationTabCount: typeof item.conversationTabCount === "number" ? item.conversationTabCount : 0,
          otherViewTabCount: typeof item.otherViewTabCount === "number" ? item.otherViewTabCount : 0,
          isConversationOpen: Boolean(item.isConversationOpen),
        }))
      : [],
  };
}

async function registerCurrentPr(): Promise<RegisterResponse> {
  if (!extensionApi?.runtime) {
    return { ok: false, reason: "not_pr_page", trackedCount: 0 };
  }

  return extensionApi.runtime.sendMessage({ type: "REGISTER_CURRENT_PR" }) as Promise<RegisterResponse>;
}

async function untrackCurrentPr(): Promise<UntrackResponse> {
  if (!extensionApi?.runtime) {
    return { ok: false, reason: "not_pr_page", trackedCount: 0 };
  }

  return extensionApi.runtime.sendMessage({ type: "UNTRACK_CURRENT_PR" }) as Promise<UntrackResponse>;
}

async function reloadTrackedPrs(): Promise<ReloadTrackedPrsResponse> {
  if (!extensionApi?.runtime) {
    return { ok: false, reloadedTabCount: 0 };
  }

  return extensionApi.runtime.sendMessage({ type: "RELOAD_TRACKED_PRS" }) as Promise<ReloadTrackedPrsResponse>;
}

async function activatePrTab(prUrl: string): Promise<{ ok: boolean }> {
  if (!extensionApi?.runtime) {
    return { ok: false };
  }

  return extensionApi.runtime.sendMessage({ type: "ACTIVATE_PR_TAB", prUrl }) as Promise<{ ok: boolean }>;
}

async function fetchModuleSettings(): Promise<ModuleSettings> {
  if (!extensionApi?.runtime) {
    return { githubPrManager: { enabled: true } };
  }

  const response = await extensionApi.runtime.sendMessage({ type: "GET_MODULE_SETTINGS" }) as Partial<{ settings: ModuleSettings }>;
  return response.settings ?? { githubPrManager: { enabled: true } };
}

async function saveModuleSettings(settings: ModuleSettings): Promise<void> {
  if (!extensionApi?.runtime) {
    return;
  }

  await extensionApi.runtime.sendMessage({ type: "SET_MODULE_SETTINGS", settings });
}

const baseCardStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: 12,
  background: "#ffffff",
};
const GITHUB_PR_PATH_PATTERN = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
const PR_STATE_ORDER: Record<TrackedPrItem["state"], number> = {
  working: 0,
  reviewing: 1,
  merge_waiting: 2,
  merged: 3,
};

function sortTrackedPrItems(items: TrackedPrItem[]): TrackedPrItem[] {
  // eslint-disable-next-line e18e/prefer-array-to-sorted
  return items.slice().sort((a, b) => {
    const stateDiff = PR_STATE_ORDER[a.state] - PR_STATE_ORDER[b.state];
    if (stateDiff !== 0) {
      return stateDiff;
    }

    return b.updatedAt - a.updatedAt;
  });
}

function parsePrUrl(prUrl: string): { repoKey: string, prNumber: string | null } {
  try {
    const parsed = new URL(prUrl);
    const match = parsed.pathname.match(GITHUB_PR_PATH_PATTERN);
    if (!match) {
      return { repoKey: "その他", prNumber: null };
    }

    return {
      repoKey: `${match[1]}/${match[2]}`,
      prNumber: match[3],
    };
  }
  catch {
    return { repoKey: "その他", prNumber: null };
  }
}

function HomeScreen({
  moduleSettings,
  onToggleGithubPr,
  onNavigateToGithubPr,
}: {
  moduleSettings: ModuleSettings
  onToggleGithubPr: (enabled: boolean) => void
  onNavigateToGithubPr: () => void
}) {
  const enabled = moduleSettings.githubPrManager.enabled;

  return (
    <main style={{ padding: 16, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111827" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 16px" }}>拡張機能モジュール</h1>

      <div
        role="button"
        tabIndex={0}
        onClick={onNavigateToGithubPr}
        onKeyDown={(e) => {
          if (e.key === "Enter")
            onNavigateToGithubPr();
        }}
        style={{
          ...baseCardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>GitHub PR Manager</p>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
            GitHub PRを追跡し、レビュー状態に応じてタブを自動グループ化します。
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleGithubPr(!enabled);
            }}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: enabled ? "#111827" : "#f3f4f6",
              color: enabled ? "#ffffff" : "#6b7280",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {enabled ? "有効" : "無効"}
          </button>
          <span style={{ fontSize: 16, color: "#9ca3af" }}>›</span>
        </div>
      </div>
    </main>
  );
}

function GithubPrScreen({ onBack }: { onBack: () => void }) {
  const [trackedCount, setTrackedCount] = useState(0);
  const [isCurrentTabPr, setIsCurrentTabPr] = useState(false);
  const [isCurrentTabTracked, setIsCurrentTabTracked] = useState(false);
  const [currentPrUrl, setCurrentPrUrl] = useState<string | null>(null);
  const [trackedPrItems, setTrackedPrItems] = useState<TrackedPrItem[]>([]);
  const [status, setStatus] = useState<UiStatus>({ tone: "neutral", message: "" });
  const [searchQuery, setSearchQuery] = useState("");

  const reloadState = useCallback(async () => {
    const state = await fetchPopupState();
    setTrackedCount(state.trackedCount);
    setIsCurrentTabPr(state.isCurrentTabPr);
    setIsCurrentTabTracked(state.isCurrentTabTracked);
    setCurrentPrUrl(state.currentPrUrl);
    setTrackedPrItems(state.trackedPrItems);
  }, []);

  useEffect(() => {
    reloadState().catch((error: unknown) => console.error(error));
  }, [reloadState]);

  const onRegister = useCallback(async () => {
    const result = await registerCurrentPr();

    setTrackedCount(result.trackedCount);

    if (!result.ok && result.reason === "not_pr_page") {
      setStatus({ tone: "warn", message: "現在のタブはGitHub PRページではありません。" });
      return;
    }

    if (!result.ok && result.reason === "already_tracked") {
      setStatus({ tone: "neutral", message: "このPRはすでに追跡中です。" });
      await reloadState();
      return;
    }

    setStatus({ tone: "success", message: "PRを追跡対象に追加しました。再表示時に状態を再判定します。" });
    await reloadState();
  }, [reloadState]);

  const onUntrack = useCallback(async () => {
    const result = await untrackCurrentPr();

    setTrackedCount(result.trackedCount);

    if (!result.ok && result.reason === "not_pr_page") {
      setStatus({ tone: "warn", message: "現在のタブはGitHub PRページではありません。" });
      return;
    }

    if (!result.ok && result.reason === "not_tracked") {
      setStatus({ tone: "neutral", message: "このPRは追跡対象ではありません。" });
      await reloadState();
      return;
    }

    setStatus({ tone: "success", message: "このPRの追跡を解除しました。" });
    await reloadState();
  }, [reloadState]);

  const onReloadTrackedPrs = useCallback(async () => {
    const result = await reloadTrackedPrs();

    if (!result.ok) {
      setStatus({ tone: "warn", message: "トラック中PRのリロードに失敗しました。" });
      return;
    }

    setStatus({
      tone: "success",
      message: `トラック中PRタブを ${result.reloadedTabCount} 件リロードしました。`,
    });
  }, []);

  const statusColor = useMemo(() => {
    if (status.tone === "success") {
      return "#166534";
    }

    if (status.tone === "warn") {
      return "#b45309";
    }

    return "#1f2937";
  }, [status.tone]);

  const stateLabelByKey: Record<TrackedPrItem["state"], string> = {
    working: "PR作業/確認中",
    reviewing: "PRレビュー中",
    merge_waiting: "PRマージ待ち",
    merged: "PRマージ済み",
  };
  const filteredTrackedPrItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return trackedPrItems;
    }

    const query = searchQuery.toLowerCase();
    return trackedPrItems.filter((item) => {
      const { prNumber } = parsePrUrl(item.prUrl);
      const titleMatch = item.title?.toLowerCase().includes(query) ?? false;
      const prNumberMatch = prNumber?.includes(query) ?? false;
      return titleMatch || prNumberMatch;
    });
  }, [trackedPrItems, searchQuery]);

  const groupedTrackedPrItems = useMemo(() => {
    const grouped = new Map<string, TrackedPrItem[]>();

    for (const item of filteredTrackedPrItems) {
      const { repoKey } = parsePrUrl(item.prUrl);
      const current = grouped.get(repoKey) ?? [];
      current.push(item);
      grouped.set(repoKey, current);
    }

    return Array.from(grouped.entries(), ([repoKey, items]) => [
      repoKey,
      sortTrackedPrItems(items),
    ] as const);
  }, [filteredTrackedPrItems]);

  return (
    <main style={{ padding: 16, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: 14,
            color: "#374151",
            display: "flex",
            alignItems: "center",
          }}
        >
          ←
        </button>
        <h1 style={{ fontSize: 18, margin: 0 }}>GitHub PR Manager</h1>
      </div>

      <section style={{ ...baseCardStyle, marginBottom: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 13 }}>
          追跡PR数:
          {" "}
          <strong>{trackedCount}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "#374151", wordBreak: "break-all" }}>
          現在タブ:
          {" "}
          {currentPrUrl ?? "PRページではありません"}
        </p>
      </section>

      <button
        type="button"
        onClick={() => {
          onRegister().catch((error: unknown) => console.error(error));
        }}
        disabled={!isCurrentTabPr || isCurrentTabTracked}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 10,
          padding: "10px 12px",
          background: !isCurrentTabPr || isCurrentTabTracked ? "#9ca3af" : "#111827",
          color: "#ffffff",
          cursor: !isCurrentTabPr || isCurrentTabTracked ? "default" : "pointer",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {isCurrentTabTracked ? "このPRは追跡済み" : "現在のPRを追跡登録"}
      </button>
      <button
        type="button"
        onClick={() => {
          onUntrack().catch((error: unknown) => console.error(error));
        }}
        disabled={!isCurrentTabTracked}
        style={{
          width: "100%",
          border: "1px solid #d1d5db",
          borderRadius: 10,
          padding: "10px 12px",
          marginTop: 8,
          background: isCurrentTabTracked ? "#ffffff" : "#f3f4f6",
          color: isCurrentTabTracked ? "#111827" : "#9ca3af",
          cursor: isCurrentTabTracked ? "pointer" : "default",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        現在のPRをuntrack
      </button>
      <button
        type="button"
        onClick={() => {
          onReloadTrackedPrs().catch((error: unknown) => console.error(error));
        }}
        style={{
          width: "100%",
          border: "1px solid #d1d5db",
          borderRadius: 10,
          padding: "10px 12px",
          marginTop: 8,
          background: "#ffffff",
          color: "#111827",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        トラック中のPRを一斉リロード
      </button>

      {status.message && (
        <p style={{ marginTop: 12, fontSize: 12, color: statusColor }}>
          {status.message}
        </p>
      )}

      <section style={{ ...baseCardStyle, marginTop: 12, background: "#f9fafb" }}>
        <p style={{ margin: 0, fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
          追跡中PRは、ページ再表示時に状態を再判定し、
          「PR作業/確認中」「PRレビュー中」「PRマージ待ち」「PRマージ済み」に自動で移動します。
        </p>
      </section>

      <section style={{ ...baseCardStyle, marginTop: 12 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 14 }}>トラック中のPR一覧</h2>
        <input
          type="text"
          placeholder="タイトルまたはPR番号で検索..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "8px 10px",
            marginBottom: 12,
            fontSize: 12,
            boxSizing: "border-box",
          }}
        />
        {trackedPrItems.length === 0
          ? (
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>追跡中のPRはありません。</p>
            )
          : filteredTrackedPrItems.length === 0
            ? (
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>検索条件に合致するPRが見つかりません。</p>
              )
            : (
                <div style={{ display: "grid", gap: 10 }}>
                  {groupedTrackedPrItems.map(([repoKey, items]) => (
                    <section key={repoKey} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                      <h3 style={{ margin: "0 0 8px", fontSize: 12, color: "#111827" }}>
                        {repoKey}
                        {" "}
                        (
                        {items.length}
                        )
                      </h3>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                        {items.map((item) => {
                          const { prNumber } = parsePrUrl(item.prUrl);

                          return (
                            <li key={item.prUrl} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                              <a
                                href={item.prUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: "block", fontSize: 12, color: "#1d4ed8", wordBreak: "break-all", fontWeight: 600 }}
                              >
                                {item.title ?? (prNumber ? `#${prNumber}` : item.prUrl)}
                              </a>
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280", wordBreak: "break-all" }}>
                                {prNumber ? `#${prNumber}` : item.prUrl}
                              </p>
                              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#374151" }}>
                                状態:
                                {" "}
                                {stateLabelByKey[item.state]}
                              </p>
                              <p style={{
                                margin: "2px 0 0",
                                fontSize: 11,
                                color: item.isConversationOpen ? "#166534" : (item.otherViewTabCount > 0 ? "#f59e0b" : "#6b7280"),
                              }}
                              >
                                タブ:
                                {" "}
                                {item.isConversationOpen
                                  ? `開いている (${item.conversationTabCount})`
                                  : (item.otherViewTabCount > 0 ? `他のビューで開いている (${item.otherViewTabCount})` : "未オープン")}
                              </p>
                              {(item.isConversationOpen || item.otherViewTabCount > 0) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    activatePrTab(item.prUrl).catch((error: unknown) => console.error(error));
                                  }}
                                  style={{
                                    width: "100%",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 6,
                                    padding: "6px 8px",
                                    marginTop: 6,
                                    background: "#f3f4f6",
                                    color: "#374151",
                                    cursor: "pointer",
                                    fontWeight: 500,
                                    fontSize: 11,
                                  }}
                                >
                                  タブをアクティブ化
                                </button>
                              )}
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
                                更新:
                                {" "}
                                {new Date(item.updatedAt).toLocaleString("ja-JP")}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
      </section>
    </main>
  );
}

type PopupView = "home" | "githubPr";

export default function PopupApp() {
  const [view, setView] = useState<PopupView>("home");
  const [moduleSettings, setModuleSettings] = useState<ModuleSettings>({
    githubPrManager: { enabled: true },
  });

  useEffect(() => {
    fetchModuleSettings()
      .then(setModuleSettings)
      .catch((error: unknown) => console.error(error));
  }, []);

  const handleToggleGithubPr = useCallback(async (enabled: boolean) => {
    const next: ModuleSettings = { githubPrManager: { enabled } };
    setModuleSettings(next);
    await saveModuleSettings(next);
  }, []);

  if (view === "githubPr") {
    return <GithubPrScreen onBack={() => setView("home")} />;
  }

  return (
    <HomeScreen
      moduleSettings={moduleSettings}
      onToggleGithubPr={enabled =>
        handleToggleGithubPr(enabled).catch((error: unknown) => console.error(error))}
      onNavigateToGithubPr={() => setView("githubPr")}
    />
  );
}
