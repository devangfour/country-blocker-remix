import { Page, Button, LegacyCard, Layout, RadioButton, LegacyStack, Link, TextField, Text, FormLayout, ColorPicker, DropZone, Thumbnail, Banner, List, EmptyState, Box } from '@shopify/polaris';
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback } from 'react';


export default function SettingsPage() {
    const linkStyle = {
        color: 'black',
        textDecoration: 'underline',
        textDecorationColor: 'blue',
    };

    const [blockingMode, setBlockingMode] = useState('disabled');
    const [countryList, setCountryList] = useState('1776 Barnes Street\nOrlando, FL 32801');
    const [textFieldValue, setTextFieldValue] = useState('Jaded Pixel');
    const [textColor, setTextColor] = useState('#000000');
    const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
    const [boxBackgroundColor, setBoxBackgroundColor] = useState('#e86161');

    const handleModeChange = useCallback(
        (_, newValue) => setBlockingMode(newValue),
        [],
    );

    const handleCountryListChange = useCallback(
        (newValue) => setCountryList(newValue),
        [],
    );

    const handleTextFieldChange = useCallback(
        (value) => setTextFieldValue(value),
        [],
    );

    const handleTextColorChange = useCallback(
        (value) => setTextColor(value),
        []
    );

    const handleBackgroundColorChange = useCallback(
        (value) => setBackgroundColor(value),
        []
    );

    const handleBoxBackgroundColorChange = useCallback(
        (value) => setBoxBackgroundColor(value),
        []
    );

    const [blockPageDescription, setBlockPageDescription] = useState('This store is not available in your country.');

    const handleBlockPageDescriptionChange = useCallback(
        (newValue) => setBlockPageDescription(newValue),
        [],
    );
    const [color, setColor] = useState({
        hue: 120,
        brightness: 1,
        saturation: 1,
    });
    const [files, setFiles] = useState([]);
    const [rejectedFiles, setRejectedFiles] = useState([]);
    const hasError = rejectedFiles.length > 0;

    const handleDrop = useCallback(
        (_droppedFiles, acceptedFiles, rejectedFiles) => {
            setFiles((files) => [...files, ...acceptedFiles]);
            setRejectedFiles(rejectedFiles);
        },
        [],
    );

    const handleSaveSettings = useCallback(() => {
        // Add your save logic here
        console.log('Settings saved');
    }, []);

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
    const Placeholder = ({ label = '', height = 'auto', width = 'auto' }) => {
        return (
            <div
                style={{
                    background: "bg-subdued",
                    height: height,
                    width: width,
                    borderRadius: 'inherit',
                }}
            >
                <div
                    style={{
                        color: '--p-color-bg-subdued',
                    }}
                >
                    <Text as="p" variant="bodyMd">
                        {label}
                    </Text>
                </div>
            </div>
        );
    };

    return (
        <Page
            backAction={{ content: 'Settings', url: '#' }}
            title="General"
            primaryAction={<Button variant="primary">Save</Button>}
        >
            <TitleBar title="Settings" />
            <Layout>
                <Layout.Section variant="oneHalf">
                    <LegacyCard title="Country Blocking Mode" sectioned>
                        <LegacyStack vertical>
                            <RadioButton
                                label="Block listed countries"
                                helpText="Block access from specified countries"
                                checked={blockingMode === 'disabled'}
                                id="disabled"
                                name="accounts"
                                onChange={handleModeChange}
                            />
                            <RadioButton
                                label="Allow only listed countries (Whitelist)"
                                helpText="Only allow access from specified countries"
                                id="optional"
                                name="accounts"
                                checked={blockingMode === 'optional'}
                                onChange={handleModeChange}
                            />
                            <div>
                                <TextField
                                    label="Country List"
                                    value={countryList}
                                    onChange={handleCountryListChange}
                                    multiline={4}
                                    autoComplete="off"
                                    placeholder='US,CA,GB,DE'
                                />
                                <p>Enter ISO country codes separated by commas (e.g., US, CA, GB, DE)</p>
                                <Link url="https://example.com" external>
                                    <span style={linkStyle}>Find country codes from here</span>
                                </Link>
                            </div>
                            <TextField
                                label="Block Page Title"
                                value={textFieldValue}
                                onChange={handleTextFieldChange}
                                maxLength={100}
                                autoComplete="off"
                                showCharacterCount
                                placeholder='Enter a title for the block page'
                            />

                            <TextField
                                label="Block Page Description"
                                value={blockPageDescription}
                                onChange={handleBlockPageDescriptionChange}
                                maxLength={500}
                                multiline={4}
                                autoComplete="off"
                                showCharacterCount
                                placeholder='Enter a description for the block page'
                            />
                            <LegacyStack vertical>
                                <Text variant="headingMd" as="h6">
                                    Appearance Settings
                                </Text>

                            </LegacyStack>
                        </LegacyStack>
                        <FormLayout>
                            <FormLayout.Group condensed>
                                <div>
                                    <TextField
                                        label="text color"
                                        onChange={handleTextColorChange}
                                        autoComplete="off"
                                        maxLength={100}
                                        showCharacterCount
                                        type="color"
                                        value={textColor}
                                    />
                                    <TextField
                                        label="Background Color"
                                        onChange={handleBackgroundColorChange}
                                        autoComplete="off"
                                        maxLength={100}
                                        showCharacterCount
                                        type="color"
                                        value={backgroundColor}
                                    />
                                </div>
                                <div>
                                    <TextField
                                        label="Box Background Color"
                                        onChange={handleBoxBackgroundColorChange}
                                        autoComplete="off" maxLength={100}
                                        showCharacterCount
                                        type="color"
                                        value={boxBackgroundColor}
                                    />
                                    <h3>Logo Upload</h3>
                                    <LegacyStack vertical>
                                        {errorMessage}
                                        <DropZone accept="image/*" type="image" onDrop={handleDrop}>
                                            {uploadedFiles}
                                            {fileUpload}
                                        </DropZone>
                                    </LegacyStack>

                                </div>
                            </FormLayout.Group>
                        </FormLayout>
                        <Button onClick={handleSaveSettings}>Save Settings</Button>


                    </LegacyCard>
                </Layout.Section>
                <Layout.Section variant="oneHalf">
                    <LegacyCard title="" sectioned>
                        <Box background="bg-fill-info" padding="400">
                            <LegacyCard sectioned>
                                <EmptyState
                                    action={{ content: 'Upload files' }}
                                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                    fullWidth
                                >
                                    <LegacyStack vertical>
                                        <Text variant="heading3xl" as="h2">
                                            Access Restricted
                                        </Text>
                                        <Text variant="bodyMd" as="p">
                                            Sorry, access to this store is not available from your location. Please contact us if you believe this is an error.
                                        </Text>

                                    </LegacyStack>
                                </EmptyState>
                            </LegacyCard>
                        </Box>
                    </LegacyCard>
                </Layout.Section>
            </Layout>
        </Page >
    );
}
