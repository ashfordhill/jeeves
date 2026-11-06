/**
 * The marketplace study: a multi-seller marketplace with Etsy's core functionality, designed as
 * clean microservices from published designs. Design intent only.
 *
 * In lanes: the user browses (download, the **Browse** action) through the Storefront API (the
 * listing grid, search and product pages), the Orders service (buyers' and sellers' orders) and the
 * Image CDN (product photos at any size), and buys and sells (upload, the **Buy & sell** action)
 * through the Shop service (a seller opens a shop and lists products), Identity (sign-in),
 * Payments (the checkout, and sellers' payouts) and the Cart service.
 *
 * What the sources agree on, and what each tile traces to:
 * - Both reference apps and both write-ups: a catalog service with its own database (Shop service,
 *   Catalog database), a cart service with a key-value store (Cart service, Cart store), a
 *   separate payment service (Payments) and orders in a relational database (Orders database).
 * - Educative and System Design Handbook: search is a separate index fed asynchronously from the
 *   catalog (Listing events, Search indexer, Search index), and the Handbook keeps catalog data for
 *   reading in "search indexes optimized for reads" (the Storefront API reads only the index).
 * - eShop, Educative, System Design Handbook: payment and orders talk through events (Order
 *   events; eShop's ordering service records the payment from an event).
 * - ByteByteGo, Educative: the payment service keeps its own database (Payments database).
 * - Stripe Connect, separate charges and transfers: one payment per order across several sellers,
 *   a webhook when it completes ("logging the sale in a database"), then a transfer to each
 *   seller's connected account; Stripe pays the sellers out (Payments, a Billing service with
 *   Stripe, publishes each paid order).
 * - Cloudflare's and AWS's image-delivery reference architectures: only originals are stored and
 *   the CDN resizes on request, caching each size (Product images; Image CDN with Image resizing
 *   on request). So no thumbnail worker.
 * - eShop: buyers and sellers sign in through one identity service (Identity, OpenID Connect).
 *
 * Design decisions:
 * - Browsing and selling are separate services, as TinyURL's redirect and create are: the Shop
 *   service is the only writer of the catalog, its photos and its events; the Storefront API reads
 *   the search index.
 * - Checkout is Payments' job: with Stripe Checkout the payment page is Stripe's, so Payments
 *   prices the cart from the catalog and opens one session for the order. The designs' separate
 *   checkout also reserves stock and arranges shipping and emails, which are left out here.
 * - Orders are recorded once paid, by one writer (the Order recorder), and read by the Orders
 *   service, as TinyURL's analytics worker and Stats API do. Links can't form a loop, so nothing
 *   runs back from Payments to an earlier tile.
 * - Stripe holds the sellers' balances (the wallet and ledger of ByteByteGo's payment system).
 * - Services verify Identity's signed tokens themselves, so no line runs from each service to it.
 * - Left out for the developer to add: stock reservation (the designs disagree: an inventory
 *   service, a catalog field, or none), shipping (each seller ships their own order), order
 *   emails, a gateway in front of the services (it would hide which services the buyer and the
 *   seller reach), recommendations, ads and currencies.
 *
 * Where Etsy differs: Etsy runs a largely PHP monolith on sharded MySQL (High Scalability), and it
 * pre-generated fixed image sizes in batches (Code as Craft, 2010).
 *
 * Sources:
 * - Educative, E-Commerce System Design: https://www.educative.io/blog/ecommerce-system-design
 * - System Design Handbook, Design an E-commerce System:
 *   https://www.systemdesignhandbook.com/guides/design-e-commerce-system-design/
 * - ByteByteGo (Alex Xu), Payment System: https://bytebytego.com/guides/payment-system/
 * - Google, Online Boutique (microservices demo):
 *   https://github.com/GoogleCloudPlatform/microservices-demo
 * - Microsoft, eShop reference application: https://github.com/dotnet/eShop
 * - Stripe Connect, separate charges and transfers:
 *   https://docs.stripe.com/connect/marketplace/tasks/accept-payment/separate-charges-and-transfers
 * - Cloudflare, Optimizing image delivery with Cloudflare image resizing and R2:
 *   https://developers.cloudflare.com/reference-architecture/diagrams/content-delivery/optimizing-image-delivery-with-cloudflare-image-resizing-and-r2/
 * - AWS, Dynamic Image Transformation for Amazon CloudFront:
 *   https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/solution-overview.html
 * - High Scalability, The Etsy Saga:
 *   https://highscalability.com/the-etsy-saga-from-silos-to-happy-to-billions-of-pageviews-a/
 * - Etsy Code as Craft, Batch Processing Millions and Millions of Images:
 *   https://codeascraft.com/2010/07/09/batch-processing-millions-of-images/
 */
import type { StudioComponent, StudioComponentConnection } from "../studio-components.ts";
import type { StudioEntry, StudioLaneAction } from "../studio-model.ts";
import type { StudioConnectionCreation } from "../studio-operations.ts";
import { createStudioStudy } from "./study.ts";

const description =
  "A multi-seller marketplace from published designs: sellers list products whose photos a CDN resizes on request; buyers search a listing index, keep a cart and pay once across sellers through Stripe Connect; paid orders are recorded for both to see.";

export const MARKETPLACE_STUDIO_EXAMPLE = {
  id: "studio-marketplace",
  version: "1.2.0",
  name: "Marketplace · studio study",
  description,
  /** SHA-256 of `description`, the study's goal. */
  goalManifestSha256: "06ee2e3ec292410794a5af62a8553da5807e4cb6eb5fddb9c254c507dd20e6de",
} as const;

const call = (
  label: string,
  protocol: "HTTPS" | "SQL" | "Redis",
): StudioConnectionCreation["planned"] => ({
  label,
  protocol,
  interaction: "Request / response",
  security: "Service identity",
});
const messaging = (label: string): StudioConnectionCreation["planned"] => ({
  label,
  protocol: "Messaging",
  interaction: "Asynchronous",
  security: "Service identity",
});
const dataAccess = (poolSize: number, statementTimeoutMs: number) =>
  ({ kind: "data-access", poolSize, readRouting: "primary", statementTimeoutMs }) as const;

const components: StudioComponent[] = [
  // Orders service: reads what the Order recorder wrote.
  {
    id: "orders-reader",
    host: "orders",
    name: "Order reader",
    description: "Reads a buyer's orders and a shop's orders.",
    settings: dataAccess(20, 1000),
  },
  // Storefront API: the buyer's reads, all from the search index.
  {
    id: "storefront-query",
    host: "storefront",
    name: "Listing search",
    description: "Queries the search index for the listing grid, search results and product pages.",
    settings: { kind: "custom" },
  },
  // Shop service: the only writer of the catalog, its photos and its events.
  {
    id: "shop-writer",
    host: "shop",
    name: "Listing writer",
    description: "Writes shops and listings.",
    settings: dataAccess(20, 2000),
  },
  {
    id: "shop-photos",
    host: "shop",
    name: "Photo uploader",
    description: "Stores each original photo; the CDN makes every smaller size.",
    settings: { kind: "custom" },
  },
  {
    id: "shop-publisher",
    host: "shop",
    name: "Listing publisher",
    description: "Publishes each listing change through an outbox in the catalog database.",
    settings: { kind: "event-publisher", outbox: "enabled" },
  },
  // Search indexer: keeps the search index in step with the catalog.
  {
    id: "indexer-consumer",
    host: "search-indexer",
    name: "Listing consumer",
    description: "Consumes listing changes with bounded retries.",
    settings: { kind: "event-consumer", concurrency: 4, batchSize: 100, retryLimit: 5 },
  },
  {
    id: "indexer-writer",
    host: "search-indexer",
    name: "Index writer",
    description: "Adds, updates or removes the listing's search document.",
    settings: { kind: "custom" },
  },
  // Payments: the checkout and Stripe Connect.
  {
    id: "payments-pricing",
    host: "payments",
    name: "Cart pricer",
    description: "Prices the cart's items from the catalog and finds each item's shop.",
    settings: dataAccess(20, 1000),
  },
  {
    id: "payments-session",
    host: "payments",
    name: "Stripe checkout",
    description:
      "Opens one Stripe Checkout Session per order, with the order as its transfer group.",
    settings: { kind: "custom" },
  },
  {
    id: "payments-webhooks",
    host: "payments",
    name: "Webhook handler",
    description: "Verifies Stripe's signed events and handles each one once.",
    settings: { kind: "custom" },
  },
  {
    id: "payments-payouts",
    host: "payments",
    name: "Seller payouts",
    description: "Onboards sellers to Stripe Connect and transfers each seller's share once paid.",
    settings: { kind: "custom" },
  },
  {
    id: "payments-records",
    host: "payments",
    name: "Payment records",
    description: "Records each order's payment and transfers, and each shop's Stripe account.",
    settings: dataAccess(20, 2000),
  },
  {
    id: "payments-publisher",
    host: "payments",
    name: "Order publisher",
    description: "Publishes each paid order through an outbox in the payments database.",
    settings: { kind: "event-publisher", outbox: "enabled" },
  },
  // Order recorder: the Orders database's only writer.
  {
    id: "recorder-consumer",
    host: "order-recorder",
    name: "Paid-order consumer",
    description: "Consumes paid orders with bounded retries.",
    settings: { kind: "event-consumer", concurrency: 4, retryLimit: 10 },
  },
  {
    id: "recorder-writer",
    host: "order-recorder",
    name: "Order writer",
    description: "Records each paid order once, by its ID, with its items, shops and payment.",
    settings: dataAccess(10, 2000),
  },
  // Cart service.
  {
    id: "cart-repository",
    host: "cart",
    name: "Cart store client",
    description: "Keeps each cart as one Redis hash that expires a week after its last change.",
    settings: { kind: "custom" },
  },
];

const uses = (id: string, from: string, to: string, via: string): StudioComponentConnection => ({
  id,
  from,
  to: { kind: "element", id: to, via },
});
const inside = (
  id: string,
  from: string,
  to: string,
  label: string,
): StudioComponentConnection => ({ id, from, to: { kind: "component", id: to }, label });
const componentConnections: StudioComponentConnection[] = [
  uses("order-reader-db", "orders-reader", "orders-db", "orders-read"),
  uses("listing-search-index", "storefront-query", "search-index", "storefront-search"),
  uses("listing-writer-db", "shop-writer", "catalog-db", "shop-catalog"),
  inside("listing-writer-publisher", "shop-writer", "shop-publisher", "Records change"),
  uses("listing-publisher-outbox", "shop-publisher", "catalog-db", "shop-catalog"),
  uses("listing-publisher-events", "shop-publisher", "listing-events", "shop-listings"),
  uses("photo-uploader-images", "shop-photos", "product-images", "shop-images"),
  uses("listing-consumer-events", "indexer-consumer", "listing-events", "listings-indexer"),
  inside("listing-consumer-writer", "indexer-consumer", "indexer-writer", "Hands listing"),
  uses("index-writer-search", "indexer-writer", "search-index", "indexer-write"),
  inside("session-pricing", "payments-session", "payments-pricing", "Prices cart"),
  uses("pricing-catalog-db", "payments-pricing", "catalog-db", "payments-prices"),
  inside("session-records", "payments-session", "payments-records", "Records payment"),
  inside("webhooks-payouts", "payments-webhooks", "payments-payouts", "Pays sellers"),
  inside("webhooks-publisher", "payments-webhooks", "payments-publisher", "Publishes paid order"),
  inside("payouts-records", "payments-payouts", "payments-records", "Records transfers"),
  uses("records-payments-db", "payments-records", "payments-db", "payments-write"),
  uses("order-publisher-outbox", "payments-publisher", "payments-db", "payments-write"),
  uses("order-publisher-events", "payments-publisher", "order-events", "payments-paid"),
  uses("paid-consumer-events", "recorder-consumer", "order-events", "paid-recorder"),
  inside("paid-consumer-writer", "recorder-consumer", "recorder-writer", "Records order"),
  uses("order-writer-db", "recorder-writer", "orders-db", "recorder-write"),
  uses("cart-client-store", "cart-repository", "cart-store", "cart-write"),
];

/** Buyers and sellers browse (download), and buy and sell (upload). */
const actions: StudioLaneAction[] = [
  { lane: "download", name: "Browse" },
  { lane: "upload", name: "Buy & sell" },
];
/**
 * Browse reaches the Storefront API, the Orders service and the Image CDN; Buy & sell reaches the
 * Shop service, Identity, Payments and the Cart service. Of the 5,184 entry and link orders,
 * scored with real ELK under the lane bands, this entry order draws the fewest crossings (one,
 * where the Orders service's read passes the Search indexer's write into the Search index above
 * it) and 34 bends; the Storefront API's read runs along the top row into the Search index, and
 * the Image CDN sits just above Product images. The Shop service's and Payments' link orders
 * don't change the drawing.
 */
const entries: StudioEntry[] = [
  { id: "download-storefront", lane: "download", element: "storefront" },
  { id: "download-orders", lane: "download", element: "orders" },
  { id: "download-image-cdn", lane: "download", element: "image-cdn" },
  { id: "upload-shop", lane: "upload", element: "shop" },
  { id: "upload-identity", lane: "upload", element: "identity" },
  { id: "upload-payments", lane: "upload", element: "payments" },
  { id: "upload-cart", lane: "upload", element: "cart" },
];

const service = (
  minReplicas: number,
  maxReplicas: number,
  requestTimeoutMs: number,
  concurrencyLimit: number,
) =>
  ({
    kind: "service",
    execution: "docker",
    language: "typescript",
    exposure: "public",
    minReplicas,
    maxReplicas,
    autoscaleOn: "requests-per-second",
    requestTimeoutMs,
    concurrencyLimit,
  }) as const;
const worker = {
  kind: "worker",
  execution: "docker",
  language: "typescript",
  concurrency: 4,
  minReplicas: 1,
  maxReplicas: 4,
  autoscaleOn: "queue-lag",
} as const;
const topic = { kind: "queue", mode: "topic", provider: "self-hosted", partitions: 6 } as const;
const postgres = { kind: "database", engine: "postgresql", provider: "self-hosted" } as const;

export function marketplaceStudioExample() {
  return createStudioStudy(
    MARKETPLACE_STUDIO_EXAMPLE,
    [
      {
        id: "orders",
        name: "Orders service",
        description: "Shows buyers their orders and sellers their shop's orders.",
        settings: service(2, 6, 2000, 500),
      },
      {
        id: "orders-db",
        name: "Orders database",
        description: "Paid orders with their items, shops, and Stripe payment and transfer IDs.",
        settings: postgres,
        owner: { kind: "element", id: "order-recorder" },
      },
      {
        id: "storefront",
        name: "Storefront API",
        description: "Serves buyers the listing grid, search results and product pages.",
        settings: service(3, 30, 1000, 2000),
      },
      {
        id: "search-index",
        name: "Search index",
        description:
          "Listings by words, category and price, with what a grid and a product page show.",
        settings: { kind: "search", engine: "opensearch", provider: "self-hosted" },
        owner: { kind: "element", id: "search-indexer" },
      },
      {
        id: "image-cdn",
        name: "Image CDN",
        description: "Serves product photos at the size each page asks for, resized and cached.",
        settings: {
          kind: "cdn",
          provider: "cloudflare",
          origin: "product-images",
          imageResizing: "on-request",
        },
      },
      {
        id: "product-images",
        name: "Product images",
        description: "Sellers' original photos; no resized copies are stored.",
        settings: { kind: "object-store", provider: "cloudflare-r2", access: "public" },
        owner: { kind: "element", id: "shop" },
      },
      {
        id: "shop",
        name: "Shop service",
        description: "Lets a seller open a shop and list products with photos.",
        settings: service(2, 6, 10000, 200),
      },
      {
        id: "catalog-db",
        name: "Catalog database",
        description: "Shops and their listings: titles, prices, quantities and photo keys.",
        settings: { ...postgres, partitionKey: "shop_id" },
        owner: { kind: "element", id: "shop" },
      },
      {
        id: "listing-events",
        name: "Listing events",
        description: "Listing changes, from the Shop service to the Search indexer.",
        settings: { ...topic, retentionSeconds: 604800 },
        owner: { kind: "element", id: "shop" },
      },
      {
        id: "search-indexer",
        name: "Search indexer",
        description: "Keeps the search index in step with listing changes.",
        settings: worker,
      },
      {
        id: "identity",
        name: "Identity",
        description: "Signs buyers and sellers in and issues the tokens the other services verify.",
        settings: {
          kind: "identity",
          execution: "docker",
          language: "typescript",
          exposure: "public",
          provider: "oidc",
          minReplicas: 2,
          maxReplicas: 4,
          autoscaleOn: "cpu",
        },
      },
      {
        id: "payments",
        name: "Payments",
        description:
          "The checkout: prices the cart, takes one Stripe payment and pays each seller their share. Sellers set up payouts here.",
        settings: {
          kind: "billing",
          execution: "docker",
          language: "typescript",
          exposure: "public",
          provider: "stripe",
          minReplicas: 2,
          maxReplicas: 6,
          autoscaleOn: "cpu",
          requestTimeoutMs: 10000,
          concurrencyLimit: 200,
        },
      },
      {
        id: "payments-db",
        name: "Payments database",
        description: "Each order's Stripe payment and transfers, and each shop's Stripe account.",
        settings: postgres,
        owner: { kind: "element", id: "payments" },
      },
      {
        id: "order-events",
        name: "Order events",
        description: "Paid orders, from Payments to the Order recorder.",
        settings: { ...topic, retentionSeconds: 1209600 },
        owner: { kind: "element", id: "payments" },
      },
      {
        id: "order-recorder",
        name: "Order recorder",
        description: "Records each paid order from Order events.",
        settings: worker,
      },
      {
        id: "cart",
        name: "Cart service",
        description: "Adds, changes and removes the items in a buyer's cart.",
        settings: service(2, 10, 1000, 1000),
      },
      {
        id: "cart-store",
        name: "Cart store",
        description: "Redis store of carts; a cart expires a week after its last change.",
        settings: {
          kind: "cache",
          engine: "redis-compatible",
          provider: "self-hosted",
          ttlSeconds: 604800,
          eviction: "none",
        },
        owner: { kind: "element", id: "cart" },
      },
    ],
    [
      {
        id: "orders-read",
        from: "orders",
        to: "orders-db",
        kind: "uses-database",
        planned: call("Reads orders", "SQL"),
        settings: {},
      },
      {
        id: "storefront-search",
        from: "storefront",
        to: "search-index",
        kind: "depends-on",
        planned: call("Searches listings", "HTTPS"),
        settings: {},
      },
      {
        id: "cdn-images",
        from: "image-cdn",
        to: "product-images",
        kind: "depends-on",
        planned: call("Reads original photos", "HTTPS"),
        settings: {},
      },
      {
        id: "shop-catalog",
        from: "shop",
        to: "catalog-db",
        kind: "uses-database",
        planned: call("Writes shops and listings", "SQL"),
        settings: {},
      },
      {
        id: "shop-images",
        from: "shop",
        to: "product-images",
        kind: "depends-on",
        planned: call("Stores original photos", "HTTPS"),
        settings: {},
      },
      {
        id: "shop-listings",
        from: "shop",
        to: "listing-events",
        kind: "depends-on",
        planned: messaging("Publishes listing changes"),
        settings: { channelUse: "publish" },
      },
      {
        id: "listings-indexer",
        from: "listing-events",
        to: "search-indexer",
        kind: "depends-on",
        planned: messaging("Delivers listing changes"),
        settings: { channelUse: "consume" },
      },
      {
        id: "indexer-write",
        from: "search-indexer",
        to: "search-index",
        kind: "depends-on",
        planned: call("Indexes listings", "HTTPS"),
        settings: {},
      },
      {
        id: "payments-prices",
        from: "payments",
        to: "catalog-db",
        kind: "uses-database",
        planned: call("Reads prices and shops", "SQL"),
        settings: {},
      },
      {
        id: "payments-write",
        from: "payments",
        to: "payments-db",
        kind: "uses-database",
        planned: call("Writes payments and payout accounts", "SQL"),
        settings: {},
      },
      {
        id: "payments-paid",
        from: "payments",
        to: "order-events",
        kind: "depends-on",
        planned: messaging("Publishes paid orders"),
        settings: { channelUse: "publish" },
      },
      {
        id: "paid-recorder",
        from: "order-events",
        to: "order-recorder",
        kind: "depends-on",
        planned: messaging("Delivers paid orders"),
        settings: { channelUse: "consume" },
      },
      {
        id: "recorder-write",
        from: "order-recorder",
        to: "orders-db",
        kind: "uses-database",
        planned: call("Writes paid orders", "SQL"),
        settings: {},
      },
      {
        id: "cart-write",
        from: "cart",
        to: "cart-store",
        kind: "uses-database",
        planned: call("Reads & writes carts", "Redis"),
        settings: {},
      },
    ],
    {
      system: {
        name: "Marketplace",
        description:
          "Sellers open shops and list products with photos; buyers browse and search them, buy from several sellers in one checkout and see their orders.",
      },
    },
    { actions, entries, components, componentConnections },
  );
}
