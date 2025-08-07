import type { File } from "@remix-run/node";
import { getShopifyAdminClient } from "./shopify.server";

type UploadResult = {
    fileId: string;
    fileStatus: string;
    resourceUrl: string;
    url?: string;
    image?: {
        url: string;
        width: number;
        height: number;
        altText?: string;
    };
};

export async function uploadToShopify(file: File, request: Request): Promise<UploadResult> {
    const admin = await getShopifyAdminClient(request);
    const buffer = await file.arrayBuffer();

    // Step 1: stagedUploadsCreate to get signed upload URL
    const stagedUploadRes = await admin.graphql(
        `#graphql
    mutation generateStagedUploadUrl($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
        {
            variables: {
                input: [
                    {
                        filename: file.name,
                        mimeType: file.type,
                        resource: "FILE",
                    },
                ],
            },
        }
    );

    const stagedJson = await stagedUploadRes.json();
    const staged = stagedJson?.data?.stagedUploadsCreate?.stagedTargets?.[0];

    console.log("Staged upload response:", staged);

    if (!staged) {
        throw new Error("Failed to get staged upload URL");
    }

    // Step 2: Upload to staged URL (Google Cloud Storage)
    
    console.log("Staged parameters:", staged.parameters);
    
    // Try a simpler approach - just upload the raw file data
    // Some Google Cloud Storage signed URLs expect raw PUT requests
    const uploadRes = await fetch(staged.url, {
        method: "PUT",
        body: buffer,
        headers: {
            'Content-Type': file.type,
        },
    });

    console.log("Upload response status:", uploadRes.status);
    console.log("Upload response headers:", Object.fromEntries(uploadRes.headers));

    if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error("Upload failed:", errorText);
        
        // If PUT fails, try POST with FormData as fallback
        console.log("Trying POST with FormData as fallback...");
        
        const form = new FormData();
        
        // Add parameters in the exact order they were provided
        for (const param of staged.parameters) {
            form.append(param.name, param.value);
        }
        
        // Add file last
        const blob = new Blob([buffer], { type: file.type });
        form.append("file", blob, file.name);

        const fallbackRes = await fetch(staged.url, {
            method: "POST",
            body: form,
        });

        if (!fallbackRes.ok) {
            const fallbackError = await fallbackRes.text();
            console.error("Fallback upload also failed:", fallbackError);
            throw new Error(`Both upload methods failed. Last error: ${fallbackError}`);
        }
        
        console.log("Fallback POST upload succeeded");
    } else {
        console.log("PUT upload succeeded");
    }

    // Step 3: fileCreate using resourceUrl from staged upload
    const fileCreateRes = await admin.graphql(
        `#graphql
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          fileStatus
          alt
          createdAt
          ... on MediaImage {
            image {
                url
              width
              height
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
        {
            variables: {
                files: [
                    {
                        alt: file.name,
                        contentType: "IMAGE",
                        originalSource: staged.resourceUrl,
                    },
                ],
            },
        }
    );

    const fileCreateJson = await fileCreateRes.json();
    const createdFile = fileCreateJson?.data?.fileCreate?.files?.[0];
    const errors = fileCreateJson?.data?.fileCreate?.userErrors;

    if (!createdFile || errors?.length) {
        throw new Error(`Shopify fileCreate failed: ${JSON.stringify(errors)}`);
    }

    let image = createdFile.image ?? null;

    // 4. If image is null, wait and retry fetching the image URL
    if (!image) {
        console.log("Image not immediately available, polling for processed image...");
        
        // Try multiple times with delays as Shopify processes the image
        for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`Attempt ${attempt} to fetch image URL...`);
            
            // Wait before each attempt (except the first)
            if (attempt > 1) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            }
            
            const fallbackResponse = await admin.graphql(
                `#graphql
          query getMediaImage($id: ID!) {
            node(id: $id) {
              ... on MediaImage {
                alt
                image {
                  url
                  width
                  height
                }
              }
            }
          }`,
                { variables: { id: createdFile.id } }
            );

            const fallbackJson = await fallbackResponse.json();
            const node = fallbackJson.data?.node;

            console.log(`Attempt ${attempt} response:`, node);

            if (node?.image?.url) {
                image = {
                    url: node.image.url,
                    width: node.image.width,
                    height: node.image.height,
                    altText: node.alt ?? null,
                };
                console.log(`Image URL found on attempt ${attempt}:`, image.url);
                break;
            }
        }
        
        // If still no image after all attempts, we'll use the resourceUrl
        if (!image) {
            console.log("Could not get processed image URL, using resourceUrl as fallback");
        }
    } else {
        image = {
            url: image.url,
            width: image.width,
            height: image.height,
            altText: createdFile.alt ?? null,
        };
    }

    // Determine the best URL to return
    const finalUrl = image?.url || staged.resourceUrl;
    console.log("Final URL being returned:", finalUrl);

    return {
        fileId: createdFile.id,
        fileStatus: createdFile.fileStatus,
        resourceUrl: staged.resourceUrl,
        url: finalUrl,
        image,
    };
}
