/** Finite same-store composition, derived from exact commerce settings, never an editable graph. */
import { contractKey } from "./architecture-contracts.ts";
import type { BackendOperation } from "./backend-behavior-model.ts";
import type { BackendModel, BackendReference } from "./backend-model.ts";

export function backendTransactionAggregates(model: BackendModel, operation: BackendOperation) {
  const refs: BackendReference[] = [operation.aggregate];
  const same = (a: BackendReference, b: BackendReference) => contractKey(a) === contractKey(b);
  const config = (r: BackendReference) => model.capabilityConfigs?.find((c) => same(c, r));
  for (const c of model.capabilityConfigs ?? []) {
    if (c.kind === "order" && same(c.aggregate, operation.aggregate)) {
      const inventory = config(c.inventory);
      if (inventory?.kind === "inventory") {
        if (same(c.checkout.operation, operation)) {
          const cart = config(c.cart);
          if (cart?.kind === "cart") refs.push(cart.aggregate, inventory.aggregate);
        }
        if (same(c.cancellation.operation, operation)) refs.push(inventory.aggregate);
      }
    }
    if (
      c.kind === "payment" &&
      (same(c.callback.operation.operation, operation) ||
        same(c.reconciliation.operation, operation))
    ) {
      const primary = model.aggregates.find((a) => same(a, operation.aggregate));
      const order = config(c.order),
        inventory = config(c.inventory);
      if (
        primary &&
        same(primary.root, c.entity) &&
        order?.kind === "order" &&
        inventory?.kind === "inventory"
      )
        refs.push(order.aggregate, inventory.aggregate);
    }
    if (
      c.kind === "fulfillment" &&
      same(c.shipment.operation, operation) &&
      same(c.aggregate, operation.aggregate)
    ) {
      const order = config(c.order),
        inventory = config(c.inventory);
      if (order?.kind === "order" && inventory?.kind === "inventory")
        refs.push(order.aggregate, inventory.aggregate);
    }
  }
  return model.aggregates.filter((a) => refs.some((r) => same(a, r)));
}
