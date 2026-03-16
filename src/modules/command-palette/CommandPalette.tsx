import { useEffect, useMemo, useRef, useState } from "react";
import { fuzzyScore } from "./fuzzy";

interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl?: string
  windowId: number
}

interface Props {
  onClose: () => void
}

export function CommandPalette({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ moduleId: "commandPalette", action: "getTabs" })
      .then((result: TabInfo[]) => {
        setTabs(result ?? []);
      })
      .catch(() => {});

    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return tabs;

    const scored: Array<{ tab: TabInfo; score: number }> = [];
    for (const tab of tabs) {
      let totalScore = 0;
      let allMatch = true;

      for (const token of tokens) {
        const titleScore = fuzzyScore(token, tab.title);
        const urlScore = fuzzyScore(token, tab.url);
        const best = Math.max(titleScore ?? -Infinity, urlScore ?? -Infinity);
        if (!isFinite(best)) { allMatch = false; break; }
        totalScore += best;
      }

      if (allMatch) scored.push({ tab, score: totalScore });
    }
    return scored.sort((a, b) => b.score - a.score).map(e => e.tab);
  }, [tabs, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function switchTab(tab: TabInfo) {
    chrome.runtime
      .sendMessage({
        moduleId: "commandPalette",
        action: "switchTab",
        payload: { tabId: tab.id, windowId: tab.windowId },
      })
      .catch(() => {});
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    }
    else if (e.key === "Enter") {
      const tab = filtered[selectedIndex];
      if (tab)
        switchTab(tab);
    }
    else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.45)",
        zIndex: 2147483647,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          width: "100%",
          maxWidth: 600,
          overflow: "hidden",
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16, color: "#9ca3af" }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="タブを検索..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 15,
              color: "#111827",
              background: "transparent",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "#9ca3af",
              background: "#f3f4f6",
              borderRadius: 4,
              padding: "2px 6px",
              whiteSpace: "nowrap",
            }}
          >
            Esc で閉じる
          </span>
        </div>

        {/* Tab list */}
        <ul
          ref={listRef}
          style={{
            listStyle: "none",
            margin: 0,
            padding: "4px 0",
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          {filtered.length === 0 && (
            <li
              style={{
                padding: "12px 16px",
                color: "#6b7280",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              タブが見つかりません
            </li>
          )}
          {filtered.map((tab, i) => (
            <li
              key={tab.id}
              onClick={() => switchTab(tab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                cursor: "pointer",
                background: i === selectedIndex ? "#f3f4f6" : "transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              {tab.favIconUrl
                ? (
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      width={16}
                      height={16}
                      style={{ flexShrink: 0, borderRadius: 2 }}
                    />
                  )
                : (
                    <span style={{ width: 16, height: 16, flexShrink: 0 }}>🌐</span>
                  )}
              <div style={{ overflow: "hidden" }}>
                <div
                  style={{
                    fontSize: 14,
                    color: "#111827",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {tab.title || "(無題)"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {tab.url}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer */}
        {filtered.length > 0 && (
          <div
            style={{
              padding: "6px 16px",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              gap: 12,
              fontSize: 11,
              color: "#9ca3af",
            }}
          >
            <span>↑↓ 選択</span>
            <span>↵ 切り替え</span>
          </div>
        )}
      </div>
    </div>
  );
}
