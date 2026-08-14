import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  type: varchar("type", { length: 24 }).notNull().default("short"),
  options: jsonb("options").notNull().default(sql`'[]'::jsonb`),
  required: boolean("required").notNull().default(false),
  position: integer("position").notNull().default(0),
  dependsOn: integer("depends_on"),
  conditionType: varchar("condition_type", { length: 10 }),
  conditionValue: varchar("condition_value", { length: 255 }),
  followUpOption: varchar("follow_up_option", { length: 255 }),
  followUpPlaceholder: text("follow_up_placeholder"),
  placeholder: varchar("placeholder", { length: 255 }),
  multipleMax: integer("multiple_max"),
  responseText: text("response_text"),
  responseTrigger: varchar("response_trigger", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const responses = pgTable("responses", {
  id: serial("id").primaryKey(),
  answers: jsonb("answers")
    .$type<Record<string, string | string[]>>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type QuestionRow = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type ResponseRow = typeof responses.$inferSelect;
export type NewResponse = typeof responses.$inferInsert;
