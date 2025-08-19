import { useCallback, useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { Page, Layout, Card, Banner, BlockStack } from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { json } from '@remix-run/node';
import { hasActiveSubscription, isExtensionEnabled } from "app/utils/extension.server";
import { SetupTasks, OwnerTask } from "./components/SetupTasks";

type Subscription = {
  status: string;
  name: string;
};

type GraphQLResponse = {
  data?: {
    currentAppInstallation?: {
      activeSubscriptions?: Subscription[];
    };
  };
  errors?: any;
};

type LoaderData = {
  hasActivePlan: boolean;
  shop: string;
  isExtensionEnable: boolean;
};

type IconSVGProps = {
  completed: boolean;
  onClick?: React.MouseEventHandler<SVGSVGElement>;
};


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  let shopResponse = `https://${session.shop}`
  let hasActivePlan = await hasActiveSubscription(admin);

  console.log("hasActivePlan", hasActivePlan);

  let isExtensionEnable = await isExtensionEnabled(admin);

  return json(
    {
      hasActivePlan,
      shop: shopResponse,
      isExtensionEnable
    }
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const { shop, hasActivePlan, isExtensionEnable } = useLoaderData<LoaderData>();
  const [hasEnabledEmbed, setHasEnabledEmbed] = useState(isExtensionEnable);
  const [completedTasks, setCompletedTasks] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("country-blocker-progress");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const markTaskComplete = useCallback((taskId: string) => {
    if (taskId === "setup-embedded") {
      setHasEnabledEmbed(true);
    }
    setCompletedTasks((prev: string[]) => [...prev, taskId]);
  }, []);
  const ownerTasks: OwnerTask[] = [
    {
      id: "setup-embedded",
      title: "Setup App Embed",
      description: isExtensionEnable
        ? "App embed is active - ready to use"
        : "Enable app embed in your theme to automatically block countries",
      action: isExtensionEnable ? "Configure" : "Enable",
      url: isExtensionEnable
        ? "/app/settings"
        : `/admin/themes/current/editor?context=apps&appEmbed=ba084c5d2a53dc94b3473b93b22b64be%2Fcountry-blocker`,
      required: true,
      completed: isExtensionEnable,
    },
    {
      id: "review-blocked-countries",
      title: "Review Blocked Countries",
      description: "Review our app",
      action: "Review",
      url: "/app/review",
      required: true,
    }
  ];
  const completedTaskCount: number = ownerTasks.filter(task => task.completed || completedTasks.includes(task.id)).length;
  const app = useAppBridge();
  const handleReviewRequest = useCallback(async () => {
    try {
      await app.reviews.request();
    } catch (error) {
      console.error('Error requesting review:', error);
      app.toast.show('Error requesting review. Please try again.', { isError: true });
    }
  }, [app]);
  const navigate = useNavigate();
  const toggleTaskCompletion = useCallback((taskId: string) => {
    setCompletedTasks((prev: string[]) => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  }, []);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  useEffect(() => {
    if (!hasActivePlan) {
      window.open(`${shop}/admin/charges/country-blocker-9/pricing_plans`, "_top");
    }
  }, [hasActivePlan, shop]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("country-blocker-progress", JSON.stringify(completedTasks));
    }
  }, [completedTasks]);
  return (
    <Page>
      <TitleBar title="Country Blocker" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {showWelcomeBanner && (
              <Banner
                title="Welcome to Country Blocker"
                tone="info"
                onDismiss={() => setShowWelcomeBanner(false)}
              >
                <p>
                  Protect your store by blocking access from specific countries.
                  Get started by configuring your blocking settings below.
                </p>
              </Banner>
            )}
            <Card>
              <SetupTasks
                ownerTasks={ownerTasks}
                completedTasks={completedTasks}
                completedTaskCount={completedTaskCount}
                markTaskComplete={markTaskComplete}
                handleReviewRequest={handleReviewRequest}
                navigate={navigate}
                shop={shop}
                toggleTaskCompletion={toggleTaskCompletion}
              />
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
