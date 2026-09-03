import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  publicNameMode: text("public_name_mode").notNull().default("anonymous"),
  publicNickname: text("public_nickname"),
  role: text("role").notNull().default("member"),
  academicStatus: text("academic_status").notNull().default("pending"),
  academicEmail: text("academic_email"),
  notificationEmail: text("notification_email"),
  phone: text("phone"),
  wechat: text("wechat"),
  qq: text("qq"),
  wechatQrKey: text("wechat_qr_key"),
  profileCompleted: integer("profile_completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("users_academic_email_idx").on(table.academicEmail)]);

export const emailChangeChallenges = sqliteTable("email_change_challenges", {
  userEmail: text("user_email").primaryKey().references(() => users.email),
  newEmail: text("new_email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastSentAt: integer("last_sent_at").notNull(),
});

export const academicEmailChallenges = sqliteTable("academic_email_challenges", {
  userEmail: text("user_email").primaryKey().references(() => users.email),
  academicEmail: text("academic_email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastSentAt: integer("last_sent_at").notNull(),
});

export const verificationAppeals = sqliteTable(
  "verification_appeals",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull().references(() => users.email),
    method: text("method").notNull().default("student_card"),
    imageKey: text("image_key"),
    status: text("status").notNull().default("pending"),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("verification_appeals_user_idx").on(table.userEmail, table.createdAt),
    index("verification_appeals_status_idx").on(table.status, table.createdAt),
  ],
);

export const listingBatches = sqliteTable(
  "listing_batches",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull(),
    ownerEmail: text("owner_email")
      .notNull()
      .references(() => users.email),
    title: text("title").notNull(),
    place: text("place").notNull(),
    latitude: integer("latitude"),
    longitude: integer("longitude"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("listing_batches_public_id_idx").on(table.publicId),
    index("listing_batches_owner_idx").on(table.ownerEmail, table.createdAt),
  ],
);

export const listingPosters = sqliteTable(
  "listing_posters",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull(),
    creatorEmail: text("creator_email").notNull().references(() => users.email),
    kind: text("kind").notNull().default("seller"),
    title: text("title").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("listing_posters_public_id_idx").on(table.publicId),
    index("listing_posters_creator_idx").on(table.creatorEmail, table.createdAt),
  ],
);

export const listingPosterItems = sqliteTable(
  "listing_poster_items",
  {
    posterId: text("poster_id").notNull().references(() => listingPosters.id),
    listingId: text("listing_id").notNull().references(() => listings.id),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("listing_poster_items_unique_idx").on(table.posterId, table.listingId),
    index("listing_poster_items_poster_idx").on(table.posterId, table.position),
    index("listing_poster_items_listing_idx").on(table.listingId),
  ],
);

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
    batchId: text("batch_id").references(() => listingBatches.id),
    batchPosition: integer("batch_position"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("listings_status_created_idx").on(table.status, table.createdAt),
    index("listings_owner_idx").on(table.ownerEmail, table.createdAt),
    index("listings_batch_idx").on(table.batchId, table.batchPosition),
  ],
);

export const listingAnalyses = sqliteTable(
  "listing_analyses",
  {
    imageKey: text("image_key").primaryKey(),
    ownerEmail: text("owner_email")
      .notNull()
      .references(() => users.email),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    riskLevel: text("risk_level").notNull().default("review"),
    riskReason: text("risk_reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("listing_analyses_owner_idx").on(table.ownerEmail, table.createdAt)],
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
    buyerNotifiedAt: text("buyer_notified_at"),
    buyerNotificationAttempts: integer("buyer_notification_attempts").notNull().default(0),
    buyerNotificationError: text("buyer_notification_error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("contact_listing_buyer_idx").on(table.listingId, table.buyerEmail),
    index("contact_seller_status_idx").on(table.sellerEmail, table.status),
    index("contact_buyer_idx").on(table.buyerEmail, table.createdAt),
  ],
);

export const emailLoginChallenges = sqliteTable(
  "email_login_challenges",
  {
    email: text("email").primaryKey(),
    codeHash: text("code_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    requestIpHash: text("request_ip_hash").notNull(),
    lastSentAt: integer("last_sent_at").notNull(),
  },
  (table) => [
    index("email_login_expires_idx").on(table.expiresAt),
    index("email_login_ip_sent_idx").on(
      table.requestIpHash,
      table.lastSentAt,
    ),
  ],
);

export const emailDeliveryLogs = sqliteTable(
  "email_delivery_logs",
  {
    id: text("id").primaryKey(),
    recipientMasked: text("recipient_masked").notNull(),
    subject: text("subject").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("sending"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("email_delivery_logs_created_idx").on(table.createdAt),
    index("email_delivery_logs_status_created_idx").on(table.status, table.createdAt),
  ],
);
