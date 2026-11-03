"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// The app's "Connect an agent" configs (src/components/app/AgentApprovals.tsx, AgentConnectCard): the three clients in
// a segmented control, the config in a grey code block with its copy button, and the app's note for each. Shown with
// the generic path, as the app shows it away from the machine Exhibit runs on. Each tab is a real, copyable config.

export type ConfigTab = { id: string; label: string; code: string; note: string };

const PATH_NOTE = "Clone the repo and replace /path/to/exhibit with where it lives. Needs Node 22.18+ on your PATH.";

export function ConfigTabs({ tabs }: { tabs: ConfigTab[] }) {
  const [tab, setTab] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);
  const current = tabs.find((t) => t.id === tab)!;
  const copy = () => {
    void navigator.clipboard?.writeText(current.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div data-ui className="s-ui s-pr-config" role="group" aria-label="Connect an agent, as the app's Settings shows it">
      <div className="s-pr-config__seg" role="group" aria-label="Choose a client">
        {tabs.map((t) => (
          <button key={t.id} type="button" aria-pressed={t.id === tab} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="s-pr-config__block">
        <pre className="s-ui-mono">
          <code>{current.code}</code>
        </pre>
        <button type="button" className="s-pr-config__copy" onClick={copy} aria-label={copied ? "Copied" : `Copy the ${current.label} config`}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </button>
        <span className="s-sr-only" aria-live="polite">
          {copied ? "Copied" : ""}
        </span>
      </div>
      <p className="s-pr-config__note">
        {PATH_NOTE} {current.note}
      </p>
    </div>
  );
}
