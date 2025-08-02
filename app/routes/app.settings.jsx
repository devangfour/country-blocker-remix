import { Layout, Card, LegacyStack, RadioButton, Link, TextField, Text, FormLayout, DropZone, Thumbnail, Banner, List, Frame, BlockStack } from '@shopify/polaris';
import { SaveBar } from "@shopify/app-bridge-react";
import { useState, useCallback, useEffect } from 'react';

export default function SettingsPage({ initialSettings, submit, isLoading, app }) {
    const [formData, setFormData] = useState({
        countryList: initialSettings?.countryList || "",
        blockingMode: initialSettings?.blockingMode || "disabled",
        redirectUrl: initialSettings?.redirectUrl || "",
        customMessage: initialSettings?.customMessage || "Access from your location is not permitted.",
        isEnabled: initialSettings?.isEnabled || false,
        blockPageTitle: initialSettings?.blockPageTitle || "Access Restricted",
        blockPageDescription: initialSettings?.blockPageDescription || "This store is not available in your country.",
        textColor: initialSettings?.textColor || "#000000",
        backgroundColor: initialSettings?.backgroundColor || "#FFFFFF",
        boxBackgroundColor: initialSettings?.boxBackgroundColor || "#e86161",
        blockedIpAddresses: initialSettings?.blockedIpAddresses || ""
    });

    console.log("Initial Settings:", initialSettings);


    // File upload state
    const [files, setFiles] = useState([]);
    const [rejectedFiles, setRejectedFiles] = useState([]);

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
        formDataToSubmit.append("countryList", JSON.stringify(formData.countryList));
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

        // Add file if uploaded
        if (files.length > 0) {
            formDataToSubmit.append('logoFile', files[0]);
        }

        submit(formDataToSubmit, { method: "post", encType: "multipart/form-data" });
        app.saveBar.hide('country-blocker-save-bar');
    }, [formData, files, submit]);

    const handleDiscard = useCallback(() => {
        setFormData({
            blockingMode: initialSettings?.blockingMode || "disabled",
            redirectUrl: initialSettings?.redirectUrl || "",
            customMessage: initialSettings?.customMessage || "Access from your location is not permitted.",
            isEnabled: initialSettings?.isEnabled || false,
            blockPageTitle: initialSettings?.blockPageTitle || "Access Restricted",
            blockPageDescription: initialSettings?.blockPageDescription || "This store is not available in your country.",
            textColor: initialSettings?.textColor || "#000000",
            backgroundColor: initialSettings?.backgroundColor || "#FFFFFF",
            boxBackgroundColor: initialSettings?.boxBackgroundColor || "#e86161",
            blockedIpAddresses: initialSettings?.blockedIpAddresses || "",
            countryList: initialSettings?.countryList,
        });
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
            </Layout>
        </Frame>
    );
}
