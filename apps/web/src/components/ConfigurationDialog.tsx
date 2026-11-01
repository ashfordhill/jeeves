import { Modal } from "@mantine/core";
import type { ReactNode } from "react";
import "./configuration-dialog.css";

/** Named compound dialog; an optional fixed footer keeps draft actions reachable. */
export function ConfigurationDialog({
  title,
  size,
  onClose,
  children,
  footer,
  fullScreen = false,
}: {
  title: string;
  size: "lg" | "xl";
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  fullScreen?: boolean;
}) {
  return (
    <Modal.Root opened onClose={onClose} size={size} fullScreen={fullScreen}>
      <Modal.Overlay />
      <Modal.Content
        aria-label={title}
        className={
          footer
            ? `configuration-dialog-fixed${fullScreen ? " configuration-dialog-full" : ""}`
            : undefined
        }
      >
        <Modal.Header role="presentation">
          <Modal.Title>{title}</Modal.Title>
          <Modal.CloseButton aria-label={`Close ${title.toLowerCase()}`} />
        </Modal.Header>
        <Modal.Body>{children}</Modal.Body>
        {footer ? <div className="configuration-dialog-footer">{footer}</div> : null}
      </Modal.Content>
    </Modal.Root>
  );
}
