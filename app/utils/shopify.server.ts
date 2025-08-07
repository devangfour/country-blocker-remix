import { authenticate } from "../shopify.server";

export async function getShopifyAdminClient(request: Request) {
  // This function should return the authenticated admin client
  // For example, if you're using Hydrogen or custom OAuth:
  const { admin } = await authenticate.admin(request);
  return admin;
}
