const retired = () => Response.json(
  { error: "旧的联系方式申请功能已停用，请使用站内匿名聊天联系卖家。" },
  { status: 410 },
);

export async function GET() {
  return retired();
}

export async function POST() {
  return retired();
}

export async function PATCH() {
  return retired();
}
