/** The draggable edge of the chat or inspector rail (240–400px); arrow keys step it by 16px. */
export function RailResize({
  side,
  value,
  onChange,
}: {
  side: "chat" | "inspector";
  value: number;
  onChange: (width: number) => void;
}) {
  return (
    <hr
      className="studio-rail-resize"
      tabIndex={0}
      aria-label={`${side === "chat" ? "Chat" : "Inspector"} width`}
      aria-orientation="vertical"
      aria-valuenow={value}
      aria-valuemin={240}
      aria-valuemax={400}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onChange(
          Math.max(
            240,
            Math.min(
              400,
              value + (event.key === "ArrowRight" ? 16 : -16) * (side === "chat" ? 1 : -1),
            ),
          ),
        );
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.dataset.start = `${event.clientX}:${value}`;
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const [start = 0, initial = value] = (event.currentTarget.dataset.start ?? "")
          .split(":")
          .map(Number);
        onChange(
          Math.max(
            240,
            Math.min(400, initial + (event.clientX - start) * (side === "chat" ? 1 : -1)),
          ),
        );
      }}
      onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
    />
  );
}
