import { sql } from "drizzle-orm";
import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const gribs = sqliteTable("gribs", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  regionNorth: real("region_north"),
  regionSouth: real("region_south"),
  regionEast: real("region_east"),
  regionWest: real("region_west"),
  forecastTime: text("forecast_time"),
  parameters: text("parameters"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  jsonPath: text("json_path"), // Path to parsed velocity JSON
  createdAt: integer("created_at").default(sql`(unixepoch())`),
});

// Infer types from schema
export type Grib = typeof gribs.$inferSelect;
export type NewGrib = typeof gribs.$inferInsert;
