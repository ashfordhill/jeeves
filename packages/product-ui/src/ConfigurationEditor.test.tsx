import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ConfigurationEditor } from "./ConfigurationEditor.tsx";

afterEach(cleanup);

test("inventory replenishment uses typed presets and consumer-owned save without QR dependencies", () => {
  const save = vi.fn();
  function Inventory() {
    const [reorderAt, setReorderAt] = useState(10);
    return (
      <ConfigurationEditor
        presets={[
          { id: "small", name: "Small stockroom", value: { reorderAt: 10 } },
          { id: "large", name: "Busy warehouse", value: { reorderAt: 200 } },
        ]}
        onPreset={(value) => setReorderAt(value.reorderAt)}
        guardChanges={false}
        status="new"
        canSave={true}
        canReset={reorderAt !== 10}
        onSave={() => save({ reorderAt })}
        onReset={() => setReorderAt(10)}
        preview={<p>Reorder when {reorderAt} items remain.</p>}
      >
        <label>
          Reorder threshold
          <input
            type="number"
            value={reorderAt}
            onChange={(e) => setReorderAt(Number(e.target.value))}
          />
        </label>
      </ConfigurationEditor>
    );
  }
  render(<Inventory />);
  expect(screen.getByRole("button", { name: "Reset changes" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Busy warehouse" }));
  expect(screen.getByText("Reorder when 200 items remain.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  expect(save).toHaveBeenCalledWith({ reorderAt: 200 });
  fireEvent.click(screen.getByRole("button", { name: "Reset changes" }));
  expect(screen.getByText("Reorder when 10 items remain.")).toBeTruthy();
});
