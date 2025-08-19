import { AdminApiContextWithoutRest } from "node_modules/@shopify/shopify-app-remix/dist/ts/server/clients";

type ThemeBlock = {
    type?: string;
    disabled?: boolean;
};

type Subscription = {
    status: string;
    name: string;
};

type GraphQLSubscriptionResponse = {
    data?: {
        currentAppInstallation?: {
            activeSubscriptions?: Subscription[];
        };
    };
    errors?: any;
};

export async function isExtensionEnabled(admin: AdminApiContextWithoutRest): Promise<boolean> {
    let isCountryBlockerEnabled = false;

    try {
        const response = await admin.graphql(`
           query GetMainThemeWithSettings {
       themes(first: 1, roles: [MAIN]) {
         edges {
           node {
             id
             name
             role
             files(filenames: ["config/settings_data.json"], first: 1) {
               nodes {
                 body {
                   ... on OnlineStoreThemeFileBodyText {
                     content
                   }
                 }
               }
             }
           }
         }
       }
     }
           `);

        const json = await response.json();

        const content = json?.data?.themes?.edges?.[0]?.node?.files?.nodes?.[0]?.body?.content;

        if (!content) {
            console.warn("No theme content found.");
            return false;
        }
        const cleanedContent = content.replace(/\/\*[\s\S]*?\*\//g, '').trim();

        const settingsData = JSON.parse(cleanedContent);

        const blocks = settingsData?.current?.blocks;
        if (!blocks || typeof blocks !== 'object') {
            console.warn("No blocks found in theme settings.");
            return false;
        }

        for (const block of Object.values(blocks) as ThemeBlock[]) {
            if (
                typeof block === 'object' &&
                block.type?.includes('blocks/country-blocker')
            ) {
                isCountryBlockerEnabled = block.disabled === false;
                break; // Stop after first match
            }
        }

    } catch (error) {
        console.error("Error while checking country blocker status:", error);
    }

    console.log("countryblocker-enabled:", isCountryBlockerEnabled);
    return isCountryBlockerEnabled;
}

export async function hasActiveSubscription(admin: AdminApiContextWithoutRest): Promise<boolean> {
    try {
        const subscriptionExec = await admin.graphql(
            `#graphql
        query GetActiveSubscriptions {
          currentAppInstallation {
            activeSubscriptions {
              status
              name
            }
          }
        }`
        );

        // Check if the response is ok before parsing
        if (!subscriptionExec.ok) {
            console.error("GraphQL request failed:", subscriptionExec.status, subscriptionExec.statusText);
            return false; // Default to true to prevent redirect loops
        }

        const subscriptionRes: GraphQLSubscriptionResponse = await subscriptionExec.json();

        // Check for GraphQL errors
        if (subscriptionRes.errors) {
            console.error("GraphQL errors:", subscriptionRes.errors);
            return false; // Default to true to prevent redirect loops
        }

        const activeSubscriptions = subscriptionRes?.data?.currentAppInstallation?.activeSubscriptions;

        console.log("Active Subscriptions:", activeSubscriptions);

        // If no subscriptions data, assume they have access
        if (!activeSubscriptions || activeSubscriptions.length === 0) {
            console.log("No subscriptions found, allowing access");
            return false;
        }

        return activeSubscriptions.some(
            (sub) => sub.status === "ACTIVE"
        );
    } catch (error) {
        console.error("Error checking active subscription:", error);
        // Return true to prevent infinite redirects when subscription check fails
        return false;
    }
}

export async function getShopData(admin: AdminApiContextWithoutRest) {
    try {
        return await admin.graphql(`
    query {
      shop {
        name
        primaryDomain {
          url
        }
        plan {
          displayName
        }
      }
    }
  `);
    } catch (error) {
        console.error("Error fetching shop info:", error);
        throw new Response("Failed to fetch shop info", { status: 500 });
    }
}

export function getDefaultSettings() {
    return {
        countryList: "",
        blockingMode: "allow",
        redirectUrl: "",
        customMessage: "Access from your location is not permitted.",
        isEnabled: false,
        blockPageTitle: "Access Restricted",
        blockPageDescription: "This store is not available in your country.",
        textColor: "#000000",
        backgroundColor: "#FFFFFF",
        boxBackgroundColor: "#ff8901",
        logoUrl: null,
        blockedIpAddresses: "",
        blockBy: "country", // Add default blockBy value
    };
}

// export async function saveMetafields(admin, settings) {
//     const shopResponse = await admin.graphql(
//         `#graphql
//         query getShop {
//           shop {
//             id
//           }
//         }`
//     );

//     const shopResult = await shopResponse.json();
//     const shopId = shopResult.data?.shop?.id;

//     const metafieldResponse = await admin.graphql(
//         `#graphql
//         mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
//           metafieldsSet(metafields: $metafields) {
//             metafields {
//               id
//               namespace
//               key
//               value
//             }
//             userErrors {
//               field
//               message
//             }
//           }
//         }`,
//         {
//             variables: {
//                 metafields: [
//                     {
//                         ownerId: shopId,
//                         namespace: "country_blocker",
//                         key: "settings",
//                         type: "json",
//                         value: JSON.stringify(settings),
//                     },
//                 ],
//             },
//         }
//     );

//     return await metafieldResponse.json();
// }