import { type DailyCount, type DateRange, dailyCounts, safeCount, utcRange } from "./range.ts";

/** Minimal structural contracts accept generated descriptors and a pg Pool without coupling versions. */
export type Resource = {
  id: string;
  access: string;
  table: string;
  fields: readonly { name: string; type: string; column: string }[];
  belongsTo: readonly { resource: string; column: string }[];
};
export type EventCountDefinition = {
  parent: Resource;
  events: Resource;
  timestampField: string;
  labelField: string;
};
export type AnalyticsConnection = {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
};
export type AnalyticsDatabase = { connect(): Promise<AnalyticsConnection> };
export type OwnedEventCounts = DateRange & {
  total: number;
  totalResources: number;
  activeResources: number;
  days: DailyCount[];
  top: { id: string; label: string | null; count: number }[];
};
const identifier = (value: string) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value))
    throw new Error("Unsupported physical resource identifier");
  return `"${value}"`;
};

/** Build once from reviewed generated descriptors; neither query text nor identifiers come from requests. */
export function ownedEventCounter(definition: EventCountDefinition) {
  const { parent, events } = definition;
  if (parent.access !== "owner" || events.access !== "internal")
    throw new Error("Event counts require an owned parent and internal events");
  const timestamp = events.fields.find(
    (field) => field.name === definition.timestampField && field.type === "timestamp",
  );
  const label = parent.fields.find(
    (field) => field.name === definition.labelField && field.type === "text",
  );
  const relations = events.belongsTo.filter((relation) => relation.resource === parent.id);
  const parentRelation = relations[0];
  if (!timestamp || !label || relations.length !== 1 || !parentRelation)
    throw new Error(
      "Event count descriptors need a timestamp, text label and unambiguous parent relation",
    );
  const p = identifier(parent.table),
    e = identifier(events.table);
  const time = `e.${identifier(timestamp.column)}`,
    title = `p.${identifier(label.column)}`;
  const relation = identifier(parentRelation.column);
  const source = `FROM ${e} e JOIN ${p} p ON p.id=e.${relation} WHERE p.owner_id=$1 AND ${time}>=$2::timestamptz AND ${time}<$3::timestamptz`;
  const statsSql = `SELECT count(*) AS total, count(DISTINCT p.id) AS active, (SELECT count(*) FROM ${p} WHERE owner_id=$1) AS resources ${source}`;
  const daysSql = `SELECT to_char(${time} AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, count(*) AS count ${source} GROUP BY 1 ORDER BY 1`;
  const topSql = `SELECT p.id, ${title} AS label, count(*) AS count ${source} GROUP BY p.id, ${title} ORDER BY count(*) DESC, p.id ASC LIMIT 10`;
  return async (
    database: AnalyticsDatabase,
    ownerId: string,
    range: DateRange,
  ): Promise<OwnedEventCounts> => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId))
      throw new Error("A valid authenticated owner is required");
    const validated = utcRange(range.from, range.to);
    const values = [ownerId, validated.start, validated.endExclusive];
    const db = await database.connect();
    try {
      await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await db.query("SET LOCAL statement_timeout = '5s'");
      const stats = (await db.query(statsSql, values)).rows[0];
      if (!stats) throw new Error("Aggregate returned no summary");
      const rows = (await db.query(daysSql, values)).rows;
      const days = dailyCounts(
        validated,
        rows.map((row) => ({ date: row.date, count: row.count })),
      );
      const topRows = (await db.query(topSql, values)).rows;
      if (topRows.length > 10) throw new Error("Aggregate exceeded top resource bound");
      const total = safeCount(stats.total);
      if (
        !Number.isSafeInteger(days.reduce((sum, day) => sum + day.count, 0)) ||
        days.reduce((sum, day) => sum + day.count, 0) !== total
      )
        throw new Error("Aggregate summary and daily counts disagree");
      const result: OwnedEventCounts = {
        from: validated.from,
        to: validated.to,
        total,
        totalResources: safeCount(stats.resources),
        activeResources: safeCount(stats.active),
        days,
        top: topRows.map((row) => ({
          id: String(row.id),
          label: row.label === null ? null : String(row.label),
          count: safeCount(row.count),
        })),
      };
      await db.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await db.query("ROLLBACK");
      } catch {
        /* Preserve the original failure. */
      }
      throw error;
    } finally {
      db.release();
    }
  };
}
