import { Page, Button, LegacyCard, Layout, RadioButton, LegacyStack, Link, TextField, Text, FormLayout, ColorPicker, DropZone, Thumbnail, Banner, List, EmptyState, Box, Spinner, Frame } from '@shopify/polaris';
import { TitleBar, useAppBridge, SaveBar } from "@shopify/app-bridge-react";
import { useState, useCallback, useEffect } from 'react';
import { useLoaderData, useActionData, useSubmit, useNavigation } from "@remix-run/react";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import connectDB from "../db.server.js";
import CountryBlockerSettings from "../models/CountryBlockerSettings.js";

// Loader function
export async function loader({ request }) {
    const { admin, session } = await authenticate.admin(request);

    await connectDB();

    try {
        // Try to get settings from database first
        let settings = await CountryBlockerSettings.findOne({ shop: session.shop });

        // If no settings in database, try to get from metafields
        if (!settings) {
            const metafieldResponse = await admin.graphql(
                `#graphql
          query getMetafield($namespace: String!, $key: String!) {
            shop {
              metafield(namespace: $namespace, key: $key) {
                id
                value
              }
            }
          }`,
                {
                    variables: {
                        namespace: "country_blocker",
                        key: "settings",
                    },
                }
            );

            const metafieldResult = await metafieldResponse.json();
            const metafieldValue = metafieldResult.data?.shop?.metafield?.value;

            if (metafieldValue) {
                const metafieldSettings = JSON.parse(metafieldValue);
                // Create settings in database from metafield data
                settings = await CountryBlockerSettings.create({
                    shop: session.shop,
                    ...metafieldSettings,
                });
            }
        }

        // Return default settings if none found
        if (!settings) {
            settings = {
                blockingMode: "disabled",
                countryList: "",
                blockPageTitle: "Access Restricted",
                blockPageDescription: "This store is not available in your country.",
                textColor: "#000000",
                backgroundColor: "#FFFFFF",
                boxBackgroundColor: "#e86161",
                logoUrl: null,
                blockedIpAddresses: "",
            };
        }

        return json({ settings });

    } catch (error) {
        console.error("Error loading settings:", error);
        return json(
            { error: "Failed to load settings", details: error.message },
            { status: 500 }
        );
    }
}

// Action function
export async function action({ request }) {
    const { admin, session } = await authenticate.admin(request);

    await connectDB();

    if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const formData = await request.formData();

        // Extract store name from session.shop (remove .myshopify.com)
        const storeName = session.shop.split('.')[0];

        // Debug: Log all form data
        console.log('Form data received:');
        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
            } else {
                console.log(`${key}: ${value}`);
            }
        }

        // Handle file upload if present
        let logoUrl = null;
        const logoFile = formData.get("logoFile");

        if (logoFile && logoFile instanceof File && logoFile.size > 0) {
            try {
                const { uploadToBunnyCDN, validateImageFile } = await import("../utils/fileUpload.server");

                console.log(`Validating file: ${logoFile.name}, size: ${logoFile.size}, type: ${logoFile.type}`);
                validateImageFile(logoFile);

                console.log(`Uploading logo for store: ${storeName}`);
                const uploadResult = await uploadToBunnyCDN(logoFile, storeName);
                logoUrl = uploadResult.url;

                console.log(`Logo uploaded successfully: ${logoUrl}`);
            } catch (uploadError) {
                console.error("File upload error:", uploadError);
                return json({
                    error: `File upload failed: ${uploadError.message}`,
                    details: uploadError.message
                }, { status: 400 });
            }
        } else {
            console.log('No valid file found for upload');
        }

        const settings = {
            blockingMode: formData.get("blockingMode") || "disabled",
            countryList: formData.get("countryList") || "",
            blockPageTitle: formData.get("blockPageTitle") || "Access Restricted",
            blockPageDescription: formData.get("blockPageDescription") || "This store is not available in your country.",
            textColor: formData.get("textColor") || "#000000",
            backgroundColor: formData.get("backgroundColor") || "#FFFFFF",
            boxBackgroundColor: formData.get("boxBackgroundColor") || "#e86161",
            logoUrl: logoUrl || formData.get("existingLogoUrl") || null,
            blockedIpAddresses: formData.get("blockedIpAddresses") || "",
        }; console.log(`Saving settings for store: ${session.shop}`, settings);

        // Save to database
        const savedSettings = await CountryBlockerSettings.findOneAndUpdate(
            { shop: session.shop },
            {
                ...settings,
                updatedAt: new Date(),
            },
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );

        // Save to Shopify App Metafields
        // First, get the shop ID
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

        if (!shopId) {
            console.error("Could not get shop ID");
            return json({
                error: "Failed to get shop ID for metafield",
                details: "Unable to retrieve shop information"
            }, { status: 400 });
        }

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

        const metafieldResult = await metafieldResponse.json();

        if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
            console.error("Metafield errors:", metafieldResult.data.metafieldsSet.userErrors);
            return json({
                error: "Failed to save to Shopify metafields",
                details: metafieldResult.data.metafieldsSet.userErrors
            }, { status: 400 });
        }

        console.log("Settings saved successfully to both database and metafields");

        return json({
            success: true,
            message: "Settings saved successfully to database and Shopify metafields",
            data: savedSettings,
            metafield: metafieldResult.data?.metafieldsSet?.metafields?.[0],
            logoUrl: logoUrl, // Return the new logo URL if uploaded
        });

    } catch (error) {
        console.error("Error saving settings:", error);
        return json(
            {
                error: "Failed to save settings",
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}


export default function SettingsPage() {
    const { settings: loadedSettings } = useLoaderData();
    const actionData = useActionData();
    const submit = useSubmit();
    const navigation = useNavigation();
    const app = useAppBridge();

    // Loading state
    const isLoading = navigation.state === "submitting";
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Form state - consolidated into single object
    const [formData, setFormData] = useState({
        blockingMode: loadedSettings?.blockingMode || 'disabled',
        countryList: loadedSettings?.countryList || '',
        blockPageTitle: loadedSettings?.blockPageTitle || 'Access Restricted',
        blockPageDescription: loadedSettings?.blockPageDescription || 'This store is not available in your country.',
        textColor: loadedSettings?.textColor || '#000000',
        backgroundColor: loadedSettings?.backgroundColor || '#FFFFFF',
        boxBackgroundColor: loadedSettings?.boxBackgroundColor || '#e86161',
        blockedIpAddresses: loadedSettings?.blockedIpAddresses || '',
    });

    // File upload state
    const [files, setFiles] = useState([]);
    const [rejectedFiles, setRejectedFiles] = useState([]);
    const hasError = rejectedFiles.length > 0;

    // Update state when loaded settings change
    useEffect(() => {
        if (loadedSettings) {
            setFormData({
                blockingMode: loadedSettings.blockingMode || 'disabled',
                countryList: loadedSettings.countryList || '',
                blockPageTitle: loadedSettings.blockPageTitle || 'Access Restricted',
                blockPageDescription: loadedSettings.blockPageDescription || 'This store is not available in your country.',
                textColor: loadedSettings.textColor || '#000000',
                backgroundColor: loadedSettings.backgroundColor || '#FFFFFF',
                boxBackgroundColor: loadedSettings.boxBackgroundColor || '#e86161',
                blockedIpAddresses: loadedSettings.blockedIpAddresses || '',
            });
            setHasUnsavedChanges(false);
        }
    }, [loadedSettings]);

    // Handle action data responses
    useEffect(() => {
        if (actionData?.success) {
            app.toast.show(actionData.message || 'Settings saved successfully!');
            setHasUnsavedChanges(false);
        } else if (actionData?.error) {
            app.toast.show(`Error: ${actionData.error}`, { isError: true });
        }
    }, [actionData, app]);

    // Mark as having unsaved changes when any field changes
    const markAsChanged = useCallback(() => {
        setHasUnsavedChanges(true);
    }, []);

    // Generic form field handler
    const handleFieldChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        markAsChanged();
    }, [markAsChanged]);

    // Specific handlers for special cases
    const handleModeChange = useCallback((_, newValue) => {
        handleFieldChange('blockingMode', newValue);
    }, [handleFieldChange]);

    const handleSaveBarDiscard = useCallback(() => {
        window.location.reload();
        app.saveBar.hide('country-blocker-save-bar');
    }, [app]);

    // Show/hide save bar based on unsaved changes
    useEffect(() => {
        if (hasUnsavedChanges) {
            app.saveBar.show('country-blocker-save-bar');
        } else {
            app.saveBar.hide('country-blocker-save-bar');
        }
    }, [hasUnsavedChanges, app]);

    const handleDrop = useCallback(
        (_droppedFiles, acceptedFiles, rejectedFiles) => {
            setFiles((files) => [...files, ...acceptedFiles]);
            setRejectedFiles(rejectedFiles);
            if (acceptedFiles.length > 0) {
                markAsChanged();
            }
        },
        [markAsChanged],
    );

    const handleSaveSettings = useCallback(() => {
        const submitData = new FormData();

        // Add all form fields
        Object.entries(formData).forEach(([key, value]) => {
            submitData.append(key, value);
        });

        // Add the actual file if uploaded
        if (files.length > 0) {
            submitData.append('logoFile', files[0]);
            console.log('Adding file to form:', files[0].name, files[0].size);
        }

        // Keep existing logo URL if no new file is uploaded
        if (loadedSettings?.logoUrl && files.length === 0) {
            submitData.append('existingLogoUrl', loadedSettings.logoUrl);
        }

        console.log('Submitting form with files:', files.length);
        submit(submitData, {
            method: "post",
            encType: "multipart/form-data"
        });
    }, [formData, files, loadedSettings?.logoUrl, submit]);

    const handleSaveBarSave = useCallback(() => {
        handleSaveSettings();
        app.saveBar.hide('country-blocker-save-bar');
    }, [handleSaveSettings, app]);

    const fileUpload = !files.length && <DropZone.FileUpload />;
    const uploadedFiles = files.length > 0 && (
        <LegacyStack vertical>
            {files.map((file, index) => (
                <LegacyStack alignment="center" key={index}>
                    <Thumbnail
                        size="small"
                        alt={file.name}
                        source={window.URL.createObjectURL(file)}
                    />
                    <div>
                        {file.name}{' '}
                        <Text variant="bodySm" as="p">
                            {file.size} bytes
                        </Text>
                    </div>
                </LegacyStack>
            ))}
        </LegacyStack>
    );

    const errorMessage = hasError && (
        <Banner title="The following images couldn’t be uploaded:" tone="critical">
            <List type="bullet">
                {rejectedFiles.map((file, index) => (
                    <List.Item key={index}>
                        {`"${file.name}" is not supported. File type must be .gif, .jpg, .png or .svg.`}
                    </List.Item>
                ))}
            </List>
        </Banner>
    );

    const linkStyle = {
        color: 'black',
        textDecoration: 'underline',
        textDecorationColor: 'blue',
    };

    return (
        <Frame>
            <Page
                backAction={{ content: 'Settings', url: '/app' }}
                title="Country Blocker Settings"
            >
                <TitleBar title="Country Blocker Settings" />

                <SaveBar id="country-blocker-save-bar">
                    <button variant="primary" onClick={handleSaveBarSave} disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={handleSaveBarDiscard} disabled={isLoading}>
                        Discard
                    </button>
                </SaveBar>

                {isLoading && (
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                        background: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        <LegacyStack vertical alignment="center">
                            <Spinner accessibilityLabel="Saving settings" size="large" />
                            <Text variant="bodyMd" as="p">Saving settings...</Text>
                        </LegacyStack>
                    </div>
                )}

                <Layout>
                    <Layout.Section variant="oneHalf">
                        <LegacyCard title="Block Settings" sectioned>
                            <LegacyStack vertical>
                                <Text variant="headingMd" as="h6">
                                    Country Blocking Configuration
                                </Text>
                                <RadioButton
                                    label="Block listed countries"
                                    helpText="Block access from specified countries"
                                    checked={formData.blockingMode === 'disabled'}
                                    id="disabled"
                                    name="accounts"
                                    onChange={handleModeChange}
                                />
                                <RadioButton
                                    label="Allow only listed countries (Whitelist)"
                                    helpText="Only allow access from specified countries"
                                    id="optional"
                                    name="accounts"
                                    checked={formData.blockingMode === 'optional'}
                                    onChange={handleModeChange}
                                />
                                <div>
                                    <TextField
                                        label="Country List"
                                        value={formData.countryList}
                                        onChange={(value) => handleFieldChange('countryList', value)}
                                        multiline={4}
                                        autoComplete="off"
                                        placeholder='US,CA,GB,DE'
                                    />
                                    <p>Enter ISO country codes separated by commas (e.g., US, CA, GB, DE)</p>
                                    <Link url="https://example.com" external={true}>
                                        <span style={linkStyle}>Find country codes from here</span>
                                    </Link>
                                </div>

                                <TextField
                                    label="Blocked IP Addresses"
                                    value={formData.blockedIpAddresses}
                                    onChange={(value) => handleFieldChange('blockedIpAddresses', value)}
                                    multiline={4}
                                    autoComplete="off"
                                    placeholder='192.168.1.1, 10.0.0.1, 203.0.113.0/24'
                                    helpText={
                                        <Text as="span" variant="bodyMd">
                                            <strong>Professional Note:</strong> Enter IP addresses or CIDR blocks separated by commas.
                                            Examples: Single IP (192.168.1.1), IP range (203.0.113.0/24),
                                            multiple IPs (1.2.3.4, 5.6.7.8). Use CIDR notation for subnets
                                            (e.g., /24 for 256 addresses, /16 for 65,536 addresses).
                                            Always test thoroughly in a staging environment before applying
                                            IP restrictions to production.
                                        </Text>
                                    }
                                />
                            </LegacyStack>
                        </LegacyCard>
                    </Layout.Section>

                    <Layout.Section variant="oneHalf">
                        <LegacyCard title="Content Settings" sectioned>
                            <LegacyStack vertical>
                                <Text variant="headingMd" as="h6">
                                    Block Page Content
                                </Text>
                                <TextField
                                    label="Block Page Title"
                                    value={formData.blockPageTitle}
                                    onChange={(value) => handleFieldChange('blockPageTitle', value)}
                                    maxLength={100}
                                    autoComplete="off"
                                    showCharacterCount
                                    placeholder='Enter a title for the block page'
                                />

                                <TextField
                                    label="Block Page Description"
                                    value={formData.blockPageDescription}
                                    onChange={(value) => handleFieldChange('blockPageDescription', value)}
                                    maxLength={500}
                                    multiline={4}
                                    autoComplete="off"
                                    showCharacterCount
                                    placeholder='Enter a description for the block page'
                                />

                                <Text variant="headingMd" as="h6">
                                    Appearance Settings
                                </Text>

                                <FormLayout>
                                    <FormLayout.Group condensed>
                                        <TextField
                                            label="Text Color"
                                            onChange={(value) => handleFieldChange('textColor', value)}
                                            autoComplete="off"
                                            maxLength={100}
                                            showCharacterCount
                                            type="color"
                                            value={formData.textColor}
                                        />
                                        <TextField
                                            label="Background Color"
                                            onChange={(value) => handleFieldChange('backgroundColor', value)}
                                            autoComplete="off"
                                            maxLength={100}
                                            showCharacterCount
                                            type="color"
                                            value={formData.backgroundColor}
                                        />
                                    </FormLayout.Group>
                                    <FormLayout.Group condensed>
                                        <TextField
                                            label="Box Background Color"
                                            onChange={(value) => handleFieldChange('boxBackgroundColor', value)}
                                            autoComplete="off"
                                            maxLength={100}
                                            showCharacterCount
                                            type="color"
                                            value={formData.boxBackgroundColor}
                                        />
                                    </FormLayout.Group>
                                </FormLayout>

                                <Text variant="headingMd" as="h6">
                                    Logo Upload
                                </Text>
                                <LegacyStack vertical>
                                    {errorMessage}
                                    <DropZone accept="image/*" type="image" onDrop={handleDrop}>
                                        {uploadedFiles}
                                        {fileUpload}
                                    </DropZone>
                                </LegacyStack>
                            </LegacyStack>
                        </LegacyCard>
                    </Layout.Section>
                </Layout>
            </Page>
        </Frame>
    );
}
