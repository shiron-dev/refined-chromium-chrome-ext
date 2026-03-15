import type { HomeTabStateResponse, PersistentHomeTabItem, RegisterCurrentHomeTabResponse, UnregisterHomeTabResponse } from "./types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackButton } from "../../../popup/BackButton";
import { baseCardStyle, getStatusColor } from "../../../popup/styles";
import type { UiStatus } from "../../../popup/styles";

const extensionApi = (globalThis as { chrome?: { runtime?: { sendMessage: (msg: unknown) => Promise<any> } } }).chrome;

async function fetchHomeTabState(): Promise<HomeTabStateResponse> {
  if (!extensionApi?.runtime) {
    return { items: [] };
  }

  const response = await extensionApi.runtime.sendMessage({ moduleId: "persistentHomeTab", action: "getState" }) as Partial<HomeTabStateResponse>;
  if (!Array.isArray(response.items)) {
    return { items: [] };
  }

  const items = response.items
    .filter((item): item is PersistentHomeTabItem => (
      typeof item.id === "string"
      && typeof item.homeUrl === "string"
      && typeof item.windowId === "number"
      && typeof item.index === "number"
      && typeof item.tabId === "number"
      && typeof item.createdAt === "number"
      && typeof item.updatedAt === "number"
      && (item.groupId === undefined || typeof item.groupId === "number")
    ))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return { items };
}

async function registerCurrentHomeTab(): Promise<RegisterCurrentHomeTabResponse> {
  if (!extensionApi?.runtime) {
    return { ok: false, reason: "no_active_tab" };
  }

  return extensionApi.runtime.sendMessage({ moduleId: "persistentHomeTab", action: "registerCurrent" }) as Promise<RegisterCurrentHomeTabResponse>;
}

async function unregisterHomeTab(id: string): Promise<UnregisterHomeTabResponse> {
  if (!extensionApi?.runtime) {
    return { ok: false, reason: "not_found" };
  }

  return extensionApi.runtime.sendMessage({ moduleId: "persistentHomeTab", action: "unregister", payload: { id } }) as Promise<UnregisterHomeTabResponse>;
}

export default function PersistentHomeTabScreen({
  enabled = true,
  onBack,
  onToggle = () => {},
}: {
  enabled?: boolean
  onBack: () => void
  onToggle?: (enabled: boolean) => void
}) {
  const [items, setItems] = useState<PersistentHomeTabItem[]>([]);
  const [status, setStatus] = useState<UiStatus>({ tone: "neutral", message: "" });

  const reloadItems = useCallback(async () => {
    const state = await fetchHomeTabState();
    setItems(state.items);
  }, []);

  useEffect(() => {
    reloadItems().catch((error: unknown) => console.error(error));
  }, [reloadItems]);

  const handleRegisterCurrentTab = useCallback(async () => {
    const result = await registerCurrentHomeTab();

    if (!result.ok && result.reason === "no_active_tab") {
      setStatus({ tone: "warn", message: "現在タブを取得できませんでした。" });
      return;
    }

    if (!result.ok && result.reason === "module_disabled") {
      setStatus({ tone: "warn", message: "Persistent Home Tabは無効化されています。" });
      return;
    }

    if (!result.ok && result.reason === "unsupported_url") {
      setStatus({ tone: "warn", message: "このURLはホームタブとして登録できません。" });
      return;
    }

    if (!result.ok && result.reason === "already_registered") {
      setStatus({ tone: "neutral", message: "このタブはすでにホームタブ登録済みです。" });
      await reloadItems();
      return;
    }

    setStatus({ tone: "success", message: "現在タブをホームタブに登録しました。" });
    await reloadItems();
  }, [reloadItems]);

  const handleUnregister = useCallback(async (id: string) => {
    const result = await unregisterHomeTab(id);

    if (!result.ok) {
      setStatus({ tone: "warn", message: "ホームタブ解除に失敗しました。" });
      await reloadItems();
      return;
    }

    setStatus({ tone: "success", message: "ホームタブを解除しました。" });
    await reloadItems();
  }, [reloadItems]);

  const statusColor = useMemo(() => getStatusColor(status.tone), [status.tone]);

  return (
    <main style={{ padding: 16, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <BackButton onClick={onBack} />
        <h1 style={{ fontSize: 18, margin: 0 }}>Persistent Home Tab</h1>
      </div>

      <section style={{ ...baseCardStyle }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          登録したタブを閉じると、同じURLを同じ場所に再作成します。
          ウィンドウが無い場合は最後の通常ウィンドウに復元します。
        </p>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          style={{
            width: "100%",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 8,
            background: enabled ? "#111827" : "#f3f4f6",
            color: enabled ? "#ffffff" : "#111827",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {enabled ? "モジュールを無効化" : "モジュールを有効化"}
        </button>
        <button
          type="button"
          onClick={() => {
            handleRegisterCurrentTab().catch((error: unknown) => console.error(error));
          }}
          disabled={!enabled}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 10,
            padding: "10px 12px",
            background: enabled ? "#111827" : "#9ca3af",
            color: "#ffffff",
            cursor: enabled ? "pointer" : "default",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          現在タブをホームタブに登録
        </button>
      </section>

      {status.message && (
        <p style={{ marginTop: 12, fontSize: 12, color: statusColor }}>
          {status.message}
        </p>
      )}

      <section style={{ ...baseCardStyle, marginTop: 12 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 14 }}>
          登録済みホームタブ
          {" "}
          (
          {items.length}
          )
        </h2>

        {items.length === 0
          ? (
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>登録済みホームタブはありません。</p>
            )
          : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {items.map(item => (
                  <li key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                    <a
                      href={item.homeUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "block", fontSize: 12, color: "#1d4ed8", wordBreak: "break-all", fontWeight: 600 }}
                    >
                      {item.homeUrl}
                    </a>
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#374151" }}>
                      window:
                      {" "}
                      {item.windowId}
                      {" / "}
                      index:
                      {" "}
                      {item.index}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
                      group:
                      {" "}
                      {item.groupId === undefined ? "なし" : item.groupId}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
                      更新:
                      {" "}
                      {new Date(item.updatedAt).toLocaleString("ja-JP")}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleUnregister(item.id).catch((error: unknown) => console.error(error));
                      }}
                      disabled={!enabled}
                      style={{
                        width: "100%",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "6px 8px",
                        marginTop: 8,
                        background: enabled ? "#ffffff" : "#f3f4f6",
                        color: enabled ? "#111827" : "#9ca3af",
                        cursor: enabled ? "pointer" : "default",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      解除
                    </button>
                  </li>
                ))}
              </ul>
            )}
      </section>
    </main>
  );
}
