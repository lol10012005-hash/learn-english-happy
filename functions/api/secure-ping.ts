export const onRequestGet = async ({
  data,
}: {
  data: Record<string, unknown>
}) => {
  return Response.json({ userId: data.userId })
}