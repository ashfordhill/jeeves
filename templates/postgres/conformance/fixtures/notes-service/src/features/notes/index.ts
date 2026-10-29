// What a coding agent would write: a feature that stores and lists notes in the service's database.
import { defineFeature } from "@jeeves/service-runtime";
import { notes } from "../../db/schema.ts";
import { database } from "../../jeeves.generated.ts";

export default defineFeature({
  name: "notes",
  register(app) {
    app.post("/notes", async (request, reply) => {
      const { body } = request.body as { body: string };
      const [row] = await database.db.insert(notes).values({ body }).returning();
      return reply.code(201).send(row);
    });
    app.get("/notes", async () => database.db.select().from(notes).orderBy(notes.id));
  },
});
