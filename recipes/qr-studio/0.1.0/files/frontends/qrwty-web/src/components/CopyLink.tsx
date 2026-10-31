import { useState } from "react";
import { Icon } from "./Icon.tsx";

export function CopyLink({ value }: { value: string }) {
  const [result, setResult] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setResult("Link copied");
    } catch {
      setResult("Couldn’t copy. Select and copy the link above.");
    }
  }
  return (
    <div className="copy-link">
      <button type="button" aria-label="Copy public link" onClick={() => void copy()}>
        <Icon name={result === "Link copied" ? "check" : "copy"} />
        Copy link
      </button>
      {result && <small role="status">{result}</small>}
    </div>
  );
}
