export async function uploadOwnerHash(email: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.toLowerCase()),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
export async function listingOwnerPrefix(email: string) {
  return `listings/${await uploadOwnerHash(email)}/`;
}
export async function isOwnedListingImageKey(email: string, imageKey: unknown) {
  return (
    typeof imageKey === "string" &&
    imageKey.length <= 240 &&
    imageKey.startsWith(await listingOwnerPrefix(email))
  );
}

export async function isOwnedVerificationImageKey(email: string, imageKey: unknown) {
  return (
    typeof imageKey === "string" &&
    imageKey.length <= 240 &&
    imageKey.startsWith(`verification/${await uploadOwnerHash(email)}/`)
  );
}
