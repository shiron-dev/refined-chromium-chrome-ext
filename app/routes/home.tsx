export function meta() {
  return [
    { title: "Chrome Extension Template" },
    { name: "description", content: "Starter dashboard for this template." },
  ];
}

const steps = [
  "public/manifest.json の name / matches / host_permissions を変更",
  "src/content_scripts/main.tsx を対象サイト向けロジックに置換",
  "src/backgrounds/background.ts のメッセージ設計を調整",
  "public/icon*.png をプロジェクトのアイコンに差し替え",
];

export default function Home() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 760, padding: "40px 20px", lineHeight: 1.6 }}>
      <h1>Chrome Extension Template</h1>
      <p>この画面はテンプレートの初期ページです。必要な実装に合わせて自由に置き換えてください。</p>

      <h2>Quick Start</h2>
      <ol>
        {steps.map(step => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <h2>Commands</h2>
      <pre style={{ background: "#f3f4f6", borderRadius: 8, padding: 16, overflowX: "auto" }}>
        <code>{"pnpm install\npnpm build\npnpm dev"}</code>
      </pre>
    </main>
  );
}
