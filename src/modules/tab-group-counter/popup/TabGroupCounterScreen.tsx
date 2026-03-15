import type { TabGroupCounterSettings, TabGroupCounterState } from "./types";
import { useCallback, useEffect, useState } from "react";
import { BackButton } from "../../../popup/BackButton";
import { baseCardStyle } from "../../../popup/styles";
import { DEFAULT_FORMAT } from "../background";

const extensionApi = (globalThis as { chrome?: { runtime?: { sendMessage: (msg: unknown) => Promise<any> } } }).chrome;

const TAB_GROUP_COLORS: Record<string, string> = {
  grey: "#9aa0a6",
  blue: "#4285f4",
  red: "#ea4335",
  yellow: "#fbbc04",
  green: "#34a853",
  pink: "#ff63b8",
  purple: "#a142f4",
  cyan: "#24c1e0",
  orange: "#fa903e",
};

function applyFormat(format: string, name: string, count: number): string {
  return format.replace(/\{name\}/g, name).replace(/\{count\}/g, String(count));
}

async function fetchGroups(): Promise<TabGroupCounterState> {
  if (!extensionApi?.runtime) {
    return { groups: [] };
  }
  const response = await extensionApi.runtime.sendMessage({ moduleId: "tabGroupCounter", action: "getGroups" }) as Partial<TabGroupCounterState>;
  return { groups: Array.isArray(response?.groups) ? response.groups : [] };
}

async function fetchSettings(): Promise<TabGroupCounterSettings> {
  if (!extensionApi?.runtime) {
    return { format: DEFAULT_FORMAT };
  }
  const response = await extensionApi.runtime.sendMessage({ moduleId: "tabGroupCounter", action: "getSettings" }) as Partial<TabGroupCounterSettings>;
  return { format: typeof response?.format === "string" ? response.format : DEFAULT_FORMAT };
}

async function saveSettings(settings: TabGroupCounterSettings): Promise<boolean> {
  if (!extensionApi?.runtime) {
    return false;
  }
  const response = await extensionApi.runtime.sendMessage({ moduleId: "tabGroupCounter", action: "saveSettings", payload: settings }) as { ok?: boolean };
  return response?.ok === true;
}

export default function TabGroupCounterScreen({
  enabled = true,
  onBack,
  onToggle = () => {},
}: {
  enabled?: boolean
  onBack: () => void
  onToggle?: (enabled: boolean) => void
}) {
  const [groups, setGroups] = useState<TabGroupCounterState["groups"]>([]);
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const [editingFormat, setEditingFormat] = useState(DEFAULT_FORMAT);
  const [saved, setSaved] = useState(false);

  const reload = useCallback(async () => {
    const [state, settings] = await Promise.all([fetchGroups(), fetchSettings()]);
    setGroups(state.groups);
    setFormat(settings.format);
    setEditingFormat(settings.format);
  }, []);

  useEffect(() => {
    reload().catch((error: unknown) => console.error(error));
  }, [reload]);

  const handleSaveFormat = useCallback(async () => {
    const ok = await saveSettings({ format: editingFormat });
    if (ok) {
      setFormat(editingFormat);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }, [editingFormat]);

  const handleResetFormat = useCallback(() => {
    setEditingFormat(DEFAULT_FORMAT);
  }, []);

  return (
    <main style={{ padding: 16, fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111827", minWidth: 300 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <BackButton onClick={onBack} />
        <h1 style={{ fontSize: 18, margin: 0 }}>Tab Group Counter</h1>
      </div>

      <section style={{ ...baseCardStyle, marginBottom: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          タブグループに登録されているタブの数を表示します。
        </p>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          style={{
            width: "100%",
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: "10px 12px",
            background: enabled ? "#111827" : "#f3f4f6",
            color: enabled ? "#ffffff" : "#111827",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {enabled ? "モジュールを無効化" : "モジュールを有効化"}
        </button>
      </section>

      <section style={{ ...baseCardStyle, marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 14 }}>表示フォーマット</h2>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280" }}>
          <code style={{ background: "#f3f4f6", borderRadius: 4, padding: "1px 4px" }}>{"{name}"}</code>
          {" "}= グループ名、
          {" "}
          <code style={{ background: "#f3f4f6", borderRadius: 4, padding: "1px 4px" }}>{"{count}"}</code>
          {" "}= タブ数
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            value={editingFormat}
            onChange={e => setEditingFormat(e.target.value)}
            style={{
              flex: 1,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 13,
              fontFamily: "monospace",
            }}
          />
          <button
            type="button"
            onClick={() => { handleResetFormat(); }}
            title="デフォルトに戻す"
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: "6px 8px",
              background: "#f3f4f6",
              color: "#374151",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            リセット
          </button>
          <button
            type="button"
            onClick={() => { handleSaveFormat().catch((error: unknown) => console.error(error)); }}
            style={{
              border: "none",
              borderRadius: 6,
              padding: "6px 10px",
              background: saved ? "#166534" : "#111827",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {saved ? "保存済" : "保存"}
          </button>
        </div>
        {editingFormat !== format && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#b45309" }}>
            未保存の変更があります
          </p>
        )}
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7280" }}>
          プレビュー:
          {" "}
          <span style={{ color: "#111827", fontWeight: 500 }}>
            {applyFormat(editingFormat, "作業中", 3)}
          </span>
        </p>
      </section>

      <section style={{ ...baseCardStyle }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 14 }}>
            タブグループ
            {" "}
            (
            {groups.length}
            )
          </h2>
          <button
            type="button"
            onClick={() => { reload().catch((error: unknown) => console.error(error)); }}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: "4px 8px",
              background: "#f9fafb",
              color: "#374151",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            更新
          </button>
        </div>

        {groups.length === 0
          ? (
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>タブグループが見つかりません。</p>
            )
          : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {groups.map(group => (
                  <li
                    key={group.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: "8px 10px",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: TAB_GROUP_COLORS[group.color] ?? "#9aa0a6",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#111827", flex: 1 }}>
                      {applyFormat(format, group.title || "(名称なし)", group.tabCount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
      </section>
    </main>
  );
}
