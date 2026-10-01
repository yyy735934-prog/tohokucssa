export type ContactStatus = "pending" | "accepted" | "declined";

export type ContactViewInput = {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerEmail: string;
  buyerName: string;
  sellerEmail: string;
  sellerName: string;
  status: string;
  createdAt: string;
  counterpartProfile?: {
    phone: string | null;
    wechat: string | null;
    qq: string | null;
    qrUrl: string | null;
  } | null;
};

export function toContactView(input: ContactViewInput, currentEmail: string) {
  const direction = input.sellerEmail === currentEmail ? "incoming" : "outgoing";
  const status: ContactStatus = ["accepted", "declined"].includes(input.status)
    ? (input.status as ContactStatus)
    : "pending";

  return {
    id: input.id,
    listingId: input.listingId,
    listingTitle: input.listingTitle,
    direction,
    counterpartName: direction === "incoming" ? input.buyerName : input.sellerName,
    status,
    createdAt: input.createdAt,
    counterpartContact:
      status === "accepted" && input.counterpartProfile
        ? input.counterpartProfile
        : null,
  };
}
