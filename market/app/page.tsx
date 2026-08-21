import { getMemberAccess } from "../lib/auth";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

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
