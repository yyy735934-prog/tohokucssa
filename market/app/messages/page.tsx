import { requireMemberAccess } from "../../lib/auth";
import MyMarketNav from "../MyMarketNav";
import MessagesClient from "./MessagesClient";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  await requireMemberAccess("/messages");
  return <main className="messages-page"><MyMarketNav active="messages" /><MessagesClient /></main>;
}
