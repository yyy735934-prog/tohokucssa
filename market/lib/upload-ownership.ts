export async function listingOwnerPrefix(email: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.toLowerCase()),
  );
  const ownerHash = Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `listings/${ownerHash}/`;
}
export async function isOwnedListingImageKey(email: string, imageKey: unknown) {
  return (
    typeof imageKey === "string" &&
    imageKey.length <= 240 &&
    imageKey.startsWith(await listingOwnerPrefix(email))
  );
}
