import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { EmptyState, Feedback, PageHeader, ProductShell } from "./ProductShell.tsx";

afterEach(cleanup);

test("an inventory consumer owns navigation, content and feedback without QR or runtime dependencies", () => {
  const { rerender } = render(
    <ProductShell
      name="Stockroom"
      navigation={[{ href: "/inventory?warehouse=west", label: "Inventory", current: true }]}
    >
      <PageHeader title="Inventory" />
      <EmptyState title="No stock yet" action={<a href="/inventory/new">Add stock</a>}>
        Add your first item.
      </EmptyState>
    </ProductShell>,
  );
  const link = screen.getByRole("link", { name: "Inventory" });
  expect(link.getAttribute("href")).toBe("/inventory?warehouse=west");
  expect(link.getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("main").id).toBe(
    screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")?.slice(1),
  );
  expect(screen.getByRole("link", { name: "Add stock" }).getAttribute("href")).toBe(
    "/inventory/new",
  );
  rerender(
    <ProductShell name="Stockroom" navigation={[]}>
      <Feedback kind="error">Inventory could not be saved. Retry.</Feedback>
    </ProductShell>,
  );
  expect(screen.getByRole("alert").textContent).toContain("could not be saved");
  expect(screen.queryByRole("status")).toBeNull();
});
