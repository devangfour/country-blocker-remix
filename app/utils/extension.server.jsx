export async function isExtensionEnabled(admin) {
  let appEnabled = false;
  let isCountryBlockerEnabled = false;

  try {
    appEnabled = await admin.graphql(`
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

    appEnabled = await appEnabled.json();

    const themesData = appEnabled.data.themes.edges[0]?.node.files.nodes[0]?.body.content;

    const themesDataJsonable = themesData.replace(
      /\/\*[\s\S]*?\*\//g, ''
    ).trim();

    const themesDataJson = JSON.parse(themesDataJsonable);

    console.log(themesDataJson.current.blocks);
    try {
      for (const [key, block] of Object.entries(themesDataJson.current.blocks)) {
        if (block.type.includes('blocks/country-blocker')) {
          isCountryBlockerEnabled = block.disabled === false;
        }
      }
    } catch (error) {
    }
  } catch (error) {
    console.log("errrrrrrrrrro", error);
  }
  console.log("countryblocker-enabled", isCountryBlockerEnabled);
  return isCountryBlockerEnabled;
}

export async function hasActiveSubscription(admin) {
  try {
    const subscriptionExec = await admin.graphql(
      `#graphql
        query AccessScopeList {
          currentAppInstallation {
            activeSubscriptions {
          status
          name
        }
          }
        }`
    );
    const subscriptionRes = await subscriptionExec.json();

    const activeSubscriptions = subscriptionRes?.data?.currentAppInstallation?.activeSubscriptions;

    return activeSubscriptions?.some(
      (sub) => sub.status === "ACTIVE"
    );
  } catch (error) {
    console.error("Error checking active subscription:", error);
    return false;
  }

}

export async function getShopData(admin) {
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

export async function saveMetafields(admin, settings) {
  const shopResponse = await admin.graphql(
    `#graphql
        query getShop {
          shop {
            id
          }
        }`
  );

  const shopResult = await shopResponse.json();
  const shopId = shopResult.data?.shop?.id;

  const metafieldResponse = await admin.graphql(
    `#graphql
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              namespace
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "country_blocker",
            key: "settings",
            type: "json",
            value: JSON.stringify(settings),
          },
        ],
      },
    }
  );

  return await metafieldResponse.json();
}