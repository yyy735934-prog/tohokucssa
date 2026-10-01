export type AcademicStatus = "verified" | "member" | "pending" | "rejected";

export function canUseMarketplace(status: string, isAdmin = false) {
  return isAdmin || status === "verified" || status === "member";
}

export function isStudentVerified(status: string) {
  return status === "verified";
}

