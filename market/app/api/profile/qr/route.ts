export async function GET() {
  return Response.json(
    { error: "交易联系方式二维码功能已停用，请使用站内匿名聊天。" },
    { status: 410 },
  );
}
