export type SellerContact = {
  phone: string | null;
  wechat: string | null;
  qq: string | null;
  hasWechatQr: boolean;
};

export function acceptedContactEmailText(listingTitle: string, contact: SellerContact) {
  const details = [
    contact.phone ? `电话：${contact.phone}` : "",
    contact.wechat ? `微信：${contact.wechat}` : "",
    contact.qq ? `QQ：${contact.qq}` : "",
    contact.hasWechatQr ? "微信二维码：请登录个人中心查看" : "",
  ].filter(Boolean);
  return [
    `卖家已接受你对“${listingTitle}”的联系申请。`,
    "",
    "卖家提供的联系方式：",
    ...details,
    "",
    "请在当面验货确认后再完成交易，不要提前转账。",
  ].join("\n");
}
