import type { Metadata } from "next";
import { getMemberAccess } from "../lib/auth";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

async function getActiveListingCount() {
  try {
    const [{ count, eq }, { getDb }, { listings }] = await Promise.all([
      import("drizzle-orm"),
      import("../db"),
      import("../db/schema"),
    ]);
    const db = await getDb();
    const rows = await db.select({ value: count() }).from(listings).where(eq(listings.status, "active"));
    return Number(rows[0]?.value ?? 0);
  } catch {
    return 0;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const activeCount = await getActiveListingCount();
  const description = `覆盖广，保隐私，安全交易就在東北集市！目前平台在售商品${activeCount}件，欢迎光顾！`;
  return {
    description,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      url: "/",
      siteName: "东北集市",
      title: "东北集市｜学友会二手平台",
      description,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "东北集市" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "东北集市｜学友会二手平台",
      description,
      images: ["/og.png"],
    },
  };
}

export default async function HomePage() {
  const user = await getMemberAccess();
  return (
    <HomeClient
      viewer={
        user
          ? {
              displayName: user.displayName,
              email: user.email,
              profileCompleted: user.profileCompleted,
            }
          : null
      }
    />
  );
}
