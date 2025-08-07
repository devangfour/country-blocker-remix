import { Layout, Card, LegacyStack, RadioButton, Link, TextField, Text, FormLayout, DropZone, Thumbnail, Banner, List, Frame, BlockStack, Tabs, Divider } from '@shopify/polaris';
import { SaveBar } from "@shopify/app-bridge-react";
import { useState, useCallback, useEffect } from 'react';

export default function SettingsPage({ initialSettings, submit, isLoading, app }) {
    const [formData, setFormData] = useState({
        countryList: initialSettings?.countryList || "",
        blockingMode: initialSettings?.blockingMode || "allow",
        redirectUrl: initialSettings?.redirectUrl || "",
        customMessage: initialSettings?.customMessage || "Access from your location is not permitted.",
        isEnabled: initialSettings?.isEnabled || false,
        blockPageTitle: initialSettings?.blockPageTitle || "Access Restricted",
        blockPageDescription: initialSettings?.blockPageDescription || "This store is not available in your country.",
        textColor: initialSettings?.textColor || "#000000",
        backgroundColor: initialSettings?.backgroundColor || "#FFFFFF",
        boxBackgroundColor: initialSettings?.boxBackgroundColor || "#e86161",
        blockedIpAddresses: initialSettings?.blockedIpAddresses || "",
        blockBy: initialSettings?.blockBy || "country" // Default to country-wise blocking
    });

    console.log("Initial Settings:", initialSettings);


    // File upload state
    const [files, setFiles] = useState([]);
    const [rejectedFiles, setRejectedFiles] = useState([]);

    // Tab state for Block By selection
    const [selectedTab, setSelectedTab] = useState(() => {
        return formData.blockBy === 'ip' ? 1 : 0; // 0 for country, 1 for ip
    });

    const handleFieldChange = useCallback((field, value) => {
        console.log("Field Change:", field, value);
        setFormData(prev => {
            const newData = { ...prev, [field]: value };

            return newData;
        });
        console.log("Updated Form Data:", { ...formData, [field]: value });
        app.saveBar.show('country-blocker-save-bar');
    }, []);

    const handleModeChange = useCallback((_, newValue) => {
        handleFieldChange('blockingMode', newValue);
    }, [handleFieldChange]);

    // Handle tab change for Block By selection
    const handleTabChange = useCallback((selectedTabIndex) => {
        setSelectedTab(selectedTabIndex);
        const blockByValue = selectedTabIndex === 0 ? 'country' : 'ip';
        handleFieldChange('blockBy', blockByValue);
    }, [handleFieldChange]);

    const handleDrop = useCallback(
        (_droppedFiles, acceptedFiles, rejectedFiles) => {
            setFiles((files) => [...files, ...acceptedFiles]);
            setRejectedFiles(rejectedFiles);
            if (acceptedFiles.length > 0) {
                app.saveBar.show('country-blocker-save-bar');
            }
        },
        [],
    );

    const handleSave = useCallback(() => {
        const formDataToSubmit = new FormData();
        formDataToSubmit.append("action", "save_settings");
        formDataToSubmit.append("countryList", formData.countryList);
        formDataToSubmit.append("blockingMode", formData.blockingMode);
        formDataToSubmit.append("redirectUrl", formData.redirectUrl);
        formDataToSubmit.append("customMessage", formData.customMessage);
        formDataToSubmit.append("isEnabled", formData.isEnabled);
        formDataToSubmit.append("blockPageTitle", formData.blockPageTitle);
        formDataToSubmit.append("blockPageDescription", formData.blockPageDescription);
        formDataToSubmit.append("textColor", formData.textColor);
        formDataToSubmit.append("backgroundColor", formData.backgroundColor);
        formDataToSubmit.append("boxBackgroundColor", formData.boxBackgroundColor);
        formDataToSubmit.append("blockedIpAddresses", formData.blockedIpAddresses);
        formDataToSubmit.append("blockBy", formData.blockBy); // Add the new blockBy field

        // Add file if uploaded
        if (files.length > 0) {
            formDataToSubmit.append('logoFile', files[0]);
        }

        // Keep existing logo URL if no new file is uploaded
        if (initialSettings?.logoUrl && files.length === 0) {
            formDataToSubmit.append('existingLogoUrl', initialSettings.logoUrl);
        }

        submit(formDataToSubmit, { method: "post", encType: "multipart/form-data" });
    }, [formData, files, initialSettings?.logoUrl, submit]);

    const handleDiscard = useCallback(() => {
        setFormData({
            blockingMode: initialSettings?.blockingMode || "allow",
            redirectUrl: initialSettings?.redirectUrl || "",
            customMessage: initialSettings?.customMessage || "Access from your location is not permitted.",
            isEnabled: initialSettings?.isEnabled || false,
            blockPageTitle: initialSettings?.blockPageTitle || "Access Restricted",
            blockPageDescription: initialSettings?.blockPageDescription || "This store is not available in your country.",
            textColor: initialSettings?.textColor || "#000000",
            backgroundColor: initialSettings?.backgroundColor || "#FFFFFF",
            boxBackgroundColor: initialSettings?.boxBackgroundColor || "#e86161",
            blockedIpAddresses: initialSettings?.blockedIpAddresses || "",
            blockBy: initialSettings?.blockBy || "country",
            countryList: initialSettings?.countryList,
        });
        // Update tab selection based on blockBy value
        setSelectedTab(initialSettings?.blockBy === 'ip' ? 1 : 0);
        setFiles([]);
        setRejectedFiles([]);
        app.saveBar.hide('country-blocker-save-bar');
    }, [initialSettings]);

    // File upload components
    const hasError = rejectedFiles.length > 0;
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
        <Banner title="The following images couldn't be uploaded:" tone="critical">
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
            <SaveBar id="country-blocker-save-bar">
                <button variant="primary" onClick={handleSave} disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button onClick={handleDiscard} disabled={isLoading}>
                    Discard
                </button>
            </SaveBar>

            <Layout>
                <Layout.Section variant="oneHalf">
                    <Card>
                        <BlockStack gap="300">
                            <Text variant="headingMd" as="h6">
                                Country Blocking Configuration
                            </Text>
                            <RadioButton
                                label="Block listed countries and IP addresses (Blacklist)"
                                helpText="Block access from specified countries and IP addresses"
                                checked={formData.blockingMode === 'allow'}
                                id="allow"
                                name="accounts"
                                onChange={handleModeChange}
                            />
                            <RadioButton
                                label="Allow only listed countries and IP addresses (Whitelist)"
                                helpText="Only allow access from specified countries and IP addresses"
                                id="whitelist"
                                name="accounts"
                                checked={formData.blockingMode === 'whitelist'}
                                onChange={handleModeChange}
                            />

                            <Divider borderColor="border" />


                            <Text variant="headingMd" as="h6">
                                Block Configuration
                            </Text>

                            <Tabs
                                tabs={[
                                    {
                                        id: 'country-tab',
                                        content: 'Country',
                                        panelID: 'country-panel'
                                    },
                                    {
                                        id: 'ip-tab',
                                        content: 'IP',
                                        panelID: 'ip-panel'
                                    }
                                ]}
                                selected={selectedTab}
                                onSelect={handleTabChange}
                            >
                                <div style={{ padding: '1rem 0' }}>
                                    {selectedTab === 0 && (
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
                                    )}

                                    {selectedTab === 1 && (
                                        <TextField
                                            label="Blocked IP Addresses"
                                            value={formData.blockedIpAddresses}
                                            onChange={(value) => handleFieldChange('blockedIpAddresses', value)}
                                            multiline={4}
                                            autoComplete="off"
                                            placeholder='192.168.1.1, 10.0.0.1, 203.0.113.0/24'
                                            helpText={
                                                <Text as="span" variant="bodyMd">
                                                    <strong>Note:</strong><br/>
                                                    Single IP: 192.168.1.1<br />
                                                    Multiple IPs: Separate with commas, e.g. 192.168.1.1, 10.0.0.5<br />
                                                    Use wildcards (*) to block or allow ranges, e.g. 10.0.*.*
                                                </Text>
                                            }
                                        />
                                    )}
                                </div>
                            </Tabs>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                <Layout.Section variant="oneHalf">
                    <Card>
                        <BlockStack gap="300">
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
                            {initialSettings?.logoUrl && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <Text variant="bodyMd" as="p" tone="subdued">Current logo:</Text>
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <img
                                            src={initialSettings.logoUrl}
                                            alt="Current logo"
                                            style={{ maxWidth: '150px', maxHeight: '150px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        />
                                    </div>
                                </div>
                            )}
                            <LegacyStack vertical>
                                {errorMessage}
                                <DropZone accept="image/*" type="image" onDrop={handleDrop}>
                                    {uploadedFiles}
                                    {fileUpload}
                                </DropZone>
                            </LegacyStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout >
        </Frame >
    );
}
