import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("member"),
  academicStatus: text("academic_status").notNull().default("pending"),
  phone: text("phone"),
  wechat: text("wechat"),
  qq: text("qq"),
  wechatQrKey: text("wechat_qr_key"),
  profileCompleted: integer("profile_completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const listings = sqliteTable(
  "listings",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email")
      .notNull()
      .references(() => users.email),
    ownerName: text("owner_name").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    price: integer("price").notNull().default(0),
    category: text("category").notNull(),
    place: text("place").notNull(),
    latitude: integer("latitude"),
    longitude: integer("longitude"),
    status: text("status").notNull().default("pending"),
    icon: text("icon").notNull().default("📦"),
    tone: text("tone").notNull().default("sage"),
    imageKey: text("image_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("listings_status_created_idx").on(table.status, table.createdAt),
    index("listings_owner_idx").on(table.ownerEmail, table.createdAt),
  ],
);

export const favorites = sqliteTable(
  "favorites",
  {
    userEmail: text("user_email").notNull().references(() => users.email),
    listingId: text("listing_id").notNull().references(() => listings.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("favorites_user_listing_idx").on(table.userEmail, table.listingId),
    index("favorites_user_created_idx").on(table.userEmail, table.createdAt),
  ],
);

export const moderationLog = sqliteTable(
  "moderation_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorEmail: text("actor_email").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    action: text("action").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("moderation_target_idx").on(table.targetType, table.targetId)],
);

export const contactRequests = sqliteTable(
  "contact_requests",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    buyerEmail: text("buyer_email")
      .notNull()
      .references(() => users.email),
    buyerName: text("buyer_name").notNull(),
    sellerEmail: text("seller_email")
      .notNull()
      .references(() => users.email),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("contact_listing_buyer_idx").on(table.listingId, table.buyerEmail),
    index("contact_seller_status_idx").on(table.sellerEmail, table.status),
    index("contact_buyer_idx").on(table.buyerEmail, table.createdAt),
  ],
);
