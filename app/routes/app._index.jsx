import {
  Card,
  Page,
  Layout,
  Button,
  Banner,
  Box,
  InlineStack,
  Text,
  BlockStack,
  Badge,
  Collapsible,
  Tooltip,
  Icon,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useState, useEffect, useCallback } from "react";
import { redirect, useNavigate, useNavigation, useSubmit, useActionData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import connectDB from "../db.server.js";
import CountryBlockerSettings from "../models/CountryBlockerSettings.js";
import SettingsPage from "./app.settings";
import { ChevronDownIcon, ChevronUpIcon } from '@shopify/polaris-icons';
import { uploadToShopify } from "../utils/uploadToShopify.server";
import { getDefaultSettings, getShopData, hasActiveSubscription, isExtensionEnabled, saveMetafields } from "../utils/extension.server.jsx";


export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = session;

  await connectDB();

  const formData = await request.formData();
  const action = formData.get("action");

  if(action == 'check_extension') {
    const isEnabled = await isExtensionEnabled(admin);
    return json({ "extension_status": isEnabled });
  }

  // Existing embed actions
  if (action === "mark_embed_enabled") {
    await CountryBlockerSettings.findOneAndUpdate(
      { shop },
      { appEmbedEnabled: true },
      { upsert: true, new: true }
    );
    return json({ success: true });
  }

  if (action === "mark_embed_disabled") {
    await CountryBlockerSettings.findOneAndUpdate(
      { shop },
      { appEmbedEnabled: false },
      { upsert: true, new: true }
    );
    return json({ success: true });
  }

  // Add settings actions here
  if (action === "save_settings") {
    const countryList = formData.get("countryList");
    const blockingMode = formData.get("blockingMode") || "allow";
    const redirectUrl = formData.get("redirectUrl") || "";
    const customMessage = formData.get("customMessage") || "Access from your location is not permitted.";
    const isEnabled = formData.get("isEnabled") === "true";
    const blockPageTitle = formData.get("blockPageTitle") || "Access Restricted";
    const blockPageDescription = formData.get("blockPageDescription") || "This store is not available in your country.";
    const textColor = formData.get("textColor") || "#FFFFFF";
    const backgroundColor = formData.get("backgroundColor") || "#FFFFFF";
    const boxBackgroundColor = formData.get("boxBackgroundColor") || "#ff8901";
    const blockedIpAddresses = formData.get("blockedIpAddresses") || "";
    const blockBy = formData.get("blockBy") || "country"; // Add the new blockBy field

    // Extract store name from session.shop (remove .myshopify.com)
    const storeName = shop.split('.')[0];


    // Handle file upload if present
    let logoUrl = null;
    const logoFile = formData.get("logoFile");

    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      try {
        console.log(`Uploading logo for store: ${storeName}`);
        console.log(`File details: ${logoFile.name}, size: ${logoFile.size}, type: ${logoFile.type}`);

        const uploadResult = await uploadToShopify(logoFile, request);
        logoUrl = uploadResult.url || uploadResult.image?.url || uploadResult.resourceUrl;

        console.log(`Logo uploaded successfully: ${logoUrl}`);
        console.log('Full upload result:', uploadResult);
      } catch (uploadError) {
        console.error("File upload error:", uploadError);
        return json({
          error: `File upload failed: ${uploadError.message}`,
          details: uploadError.message
        }, { status: 400 });
      }
    } else {
      console.log('No valid file found for upload');
      // Keep existing logo URL if no new file is uploaded
      const existingLogoUrl = formData.get("existingLogoUrl");
      if (existingLogoUrl) {
        logoUrl = existingLogoUrl;
      }
    }

    try {

      const settings = await CountryBlockerSettings.findOneAndUpdate(
        { shop },
        {
          countryList,
          blockingMode,
          redirectUrl,
          customMessage,
          isEnabled,
          blockPageTitle,
          blockPageDescription,
          textColor,
          backgroundColor,
          boxBackgroundColor,
          blockedIpAddresses,
          blockBy, // Add the new blockBy field
          ...(logoUrl && { logoUrl }), // Only update logoUrl if a new file was uploaded
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      const metafieldResult = await saveMetafields(admin, settings);

      console.log("Metafield response:", metafieldResult.data?.metafieldsSet);

      return json({
        success: true,
        settings,
        metafield: metafieldResult.data?.metafieldsSet?.metafields?.[0],
        message: "Settings saved successfully",
        ...(logoUrl && { logoUrl }) // Return the new logo URL if uploaded
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return json({ success: false });
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  await connectDB();

  // Get shop info
  const { admin } = await authenticate.admin(request);

  let shopResponse = await getShopData(admin);

  let redirectToBilling = false;
  const hasActivePlan = await hasActiveSubscription(admin);
  if (!hasActivePlan) {
    redirectToBilling = true;
  }

  const shopData = await shopResponse.json();
  const isCountryBlockerEnabled = await isExtensionEnabled(admin);

  // Get settings from database
  const settings = await CountryBlockerSettings.findOne({ shop });

  return json({
    shop: shopData.data.shop,
    appEmbedEnabled: settings?.appEmbedEnabled || false,
    settings: settings || getDefaultSettings(),
    redirectToBilling,
    isCountryBlockerEnabled
  });
}

export default function Index() {
  const { shop, appEmbedEnabled, settings, redirectToBilling, isCountryBlockerEnabled } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData();
  const app = useAppBridge();

  // Get progress from localStorage
  const [completedTasks, setCompletedTasks] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("country-blocker-progress");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Auto-redirect to settings if embed is enabled but settings task is not complete
  useEffect(() => {
    if (appEmbedEnabled && !completedTasks.includes("configure-settings")) {
      // Small delay to allow the page to render first
      const timer = setTimeout(() => {
        navigate("/app/settings");
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (redirectToBilling) {
      window.open(`${shop.primaryDomain.url}/admin/charges/country-blocker-9/pricing_plans`, "_top");
      //  console.log(shop, `https://${shop.primaryDomain.url}/admin/charges/country-blocker-9/pricing_plans`);
    }
  }, [appEmbedEnabled, completedTasks, navigate, redirectToBilling, shop]);

  // Save progress to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("country-blocker-progress", JSON.stringify(completedTasks));
    }
  }, [completedTasks]);

  const [hasEnabledEmbed,setHasEnabledEmbed] = useState(isCountryBlockerEnabled);

  const markTaskComplete = useCallback((taskId) => {

    if(taskId === "setup-embedded") {
      setHasEnabledEmbed(true);
    }

    setCompletedTasks(prev => [...prev, taskId]);
  }, []);

  // Check if app embed is enabled

  console.log(typeof hasEnabledEmbed, hasEnabledEmbed);
  const shouldRedirect = appEmbedEnabled && !completedTasks.includes("configure-settings");

  const tasks = [
    {
      id: "setup-embedded",
      title: "Setup App Embed",
      description: hasEnabledEmbed
        ? "App embed is active - ready to use"
        : "Enable app embed in your theme to automatically block countries",
      action: hasEnabledEmbed ? "Configure" : "Enable",
      url: hasEnabledEmbed
        ? "/app/settings"
        : `/admin/themes/current/editor?context=apps&appEmbed=ba084c5d2a53dc94b3473b93b22b64be%2Fcountry-blocker`,
      required: true,
      completed: hasEnabledEmbed,
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

  const IconSVG = ({ completed, onClick }) =>
    completed ? (
      <svg style={{ cursor: 'pointer' }} onClick={onClick} width="20" height="20" viewBox="2 2 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#000"></circle><path fill="#fff" d="M17.2738 8.52629C17.6643 8.91682 17.6643 9.54998 17.2738 9.94051L11.4405 15.7738C11.05 16.1644 10.4168 16.1644 10.0263 15.7738L7.3596 13.1072C6.96908 12.7166 6.96908 12.0835 7.3596 11.693C7.75013 11.3024 8.38329 11.3024 8.77382 11.693L10.7334 13.6525L15.8596 8.52629C16.2501 8.13577 16.8833 8.13577 17.2738 8.52629Z"></path></svg>
    ) : (
      <svg style={{ cursor: 'pointer' }} onClick={onClick} width="20" height="20" viewBox="2 2 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="black" fill-rule="evenodd" clip-rule="evenodd" d="M10.5334 2.10692C11.0126 2.03643 11.5024 2 12 2C12.4976 2 12.9874 2.03643 13.4666 2.10692C14.013 2.18729 14.3908 2.6954 14.3104 3.2418C14.23 3.78821 13.7219 4.166 13.1755 4.08563C12.7924 4.02927 12.3999 4 12 4C11.6001 4 11.2076 4.02927 10.8245 4.08563C10.2781 4.166 9.76995 3.78821 9.68958 3.2418C9.6092 2.6954 9.987 2.18729 10.5334 2.10692ZM7.44122 4.17428C7.77056 4.61763 7.67814 5.24401 7.23479 5.57335C6.603 6.04267 6.04267 6.603 5.57335 7.23479C5.24401 7.67814 4.61763 7.77056 4.17428 7.44122C3.73094 7.11188 3.63852 6.4855 3.96785 6.04216C4.55386 5.25329 5.25329 4.55386 6.04216 3.96785C6.4855 3.63852 7.11188 3.73094 7.44122 4.17428ZM16.5588 4.17428C16.8881 3.73094 17.5145 3.63852 17.9578 3.96785C18.7467 4.55386 19.4461 5.25329 20.0321 6.04216C20.3615 6.4855 20.2691 7.11188 19.8257 7.44122C19.3824 7.77056 18.756 7.67814 18.4267 7.23479C17.9573 6.603 17.397 6.04267 16.7652 5.57335C16.3219 5.24401 16.2294 4.61763 16.5588 4.17428ZM3.2418 9.68958C3.78821 9.76995 4.166 10.2781 4.08563 10.8245C4.02927 11.2076 4 11.6001 4 12C4 12.3999 4.02927 12.7924 4.08563 13.1755C4.166 13.7219 3.78821 14.23 3.2418 14.3104C2.6954 14.3908 2.18729 14.013 2.10692 13.4666C2.03643 12.9874 2 12.4976 2 12C2 11.5024 2.03643 11.0126 2.10692 10.5334C2.18729 9.987 2.6954 9.6092 3.2418 9.68958ZM20.7582 9.68958C21.3046 9.6092 21.8127 9.987 21.8931 10.5334C21.9636 11.0126 22 11.5024 22 12C22 12.4976 21.9636 12.9874 21.8931 13.4666C21.8127 14.013 21.3046 14.3908 20.7582 14.3104C20.2118 14.23 19.834 13.7219 19.9144 13.1755C19.9707 12.7924 20 12.3999 20 12C20 11.6001 19.9707 11.2076 19.9144 10.8245C19.834 10.2781 20.2118 9.76995 20.7582 9.68958ZM4.17428 16.5588C4.61763 16.2294 5.24401 16.3219 5.57335 16.7652C6.04267 17.397 6.603 17.9573 7.23479 18.4267C7.67814 18.756 7.77056 19.3824 7.44122 19.8257C7.11188 20.2691 6.4855 20.3615 6.04216 20.0321C5.25329 19.4461 4.55386 18.7467 3.96785 17.9578C3.63852 17.5145 3.73094 16.8881 4.17428 16.5588ZM19.8257 16.5588C20.2691 16.8881 20.3615 17.5145 20.0321 17.9578C19.4461 18.7467 18.7467 19.4461 17.9578 20.0321C17.5145 20.3615 16.8881 20.2691 16.5588 19.8257C16.2294 19.3824 16.3219 18.756 16.7652 18.4267C17.397 17.9573 17.9573 17.397 18.4267 16.7652C18.756 16.3219 19.3824 16.2294 19.8257 16.5588ZM9.68958 20.7582C9.76995 20.2118 10.2781 19.834 10.8245 19.9144C11.2076 19.9707 11.6001 20 12 20C12.3999 20 12.7924 19.9707 13.1755 19.9144C13.7219 19.834 14.23 20.2118 14.3104 20.7582C14.3908 21.3046 14.013 21.8127 13.4666 21.8931C12.9874 21.9636 12.4976 22 12 22C11.5024 22 11.0126 21.9636 10.5334 21.8931C9.987 21.8127 9.6092 21.3046 9.68958 20.7582Z"></path><circle cx="12" cy="12" r="9" stroke-width="2"></circle></svg>
    );

  // Add a new function to toggle task completion
  const toggleTaskCompletion = useCallback((taskId) => {
    setCompletedTasks(prev => {
      if (prev.includes(taskId)) {
        // Remove from completed tasks
        return prev.filter(id => id !== taskId);
      } else {
        // Add to completed tasks
        return [...prev, taskId];
      }
    });
  }, []);

  const completedCount = tasks.filter(task => task.completed || completedTasks.includes(task.id)).length;


  const [openIndex, setOpenIndex] = useState(0);
  const toggleSection = useCallback((index) => {
    setOpenIndex(prevIndex => (prevIndex === index ? null : index));
  }, []);

  /* Review request handler */
  const handleReviewRequest = useCallback(async () => {
    try {
      const result = await app.reviews.request();
      // if (!result.success) {Setup App Embed
    } catch (error) {
      console.error('Error requesting review:', error);
      app.toast.show('Error requesting review. Please try again.', { isError: true });
    }
  }, [app]);

  // Add state for toggling the section
  const [isExpanded, setIsExpanded] = useState(true);

  // Update the toggle function
  const toggleMainSection = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);

  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  // Fix: Move the toast logic into useEffect to prevent showing on every render
  useEffect(() => {
    if (actionData?.success) {
      app.toast.show('Settings saved successfully!', { isError: false });
      app.saveBar.hide('country-blocker-save-bar');
    }
  }, [actionData, app]); // Changed from actionData?.success to actionData to prevent multiple triggers

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const taskBoxStyles = `
  .task-box {
    transition: background-color 0.2s ease;
    cursor: pointer;
  }
  .task-box:hover {
    background-color: var(--p-color-bg-fill-transparent-hover) !important;
  }
  .task-box--active {
    background-color: var(--p-color-bg-fill-transparent-selected) !important;
  }
`;

  // Add the styles once when component mounts
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const styleSheet = document.createElement("style");
      styleSheet.textContent = taskBoxStyles;
      document.head.appendChild(styleSheet);
      return () => {
        if (document.head.contains(styleSheet)) {
          document.head.removeChild(styleSheet);
        }
      };
    }
  }, []);

  return (
    <Page>
      <TitleBar title="Country Blocker" />

      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Redirect Banner */}
            {shouldRedirect && (
              <Banner
                title="Redirecting to Settings"
                status="success"
              >
                <p>
                  App embed is enabled! Redirecting you to the settings page to configure your country blocking...
                </p>
              </Banner>
            )}

            {/* Welcome Banner */}
            {!shouldRedirect && showWelcomeBanner && (
              <Banner
                title="Welcome to Country Blocker"
                status="info"
                onDismiss={() => setShowWelcomeBanner(false)}
              >
                <p>
                  Protect your store by blocking access from specific countries.
                  Get started by configuring your blocking settings below.
                </p>
              </Banner>
            )}


            {/* Setup Tasks */}
            <Card>
              <BlockStack gap="400">
                <div style={{ cursor: 'pointer' }} onClick={toggleMainSection}>

                  <InlineStack align="space-between">
                    <InlineStack gap="200">
                      <BlockStack gap="200">
                        <Text variant="headingMd" as="h2">
                          Setup Tasks
                        </Text>
                        <Text as="p" fontWeight="bold">
                          <Badge>{completedCount} / {tasks.length} Completed</Badge>
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      <Icon
                        source={isExpanded ? ChevronUpIcon : ChevronDownIcon}
                        tone="base"
                      />
                    </Text>
                  </InlineStack>
                </div>
                <Collapsible open={isExpanded}>
                  <BlockStack>
                    {tasks.map((task, index) => {
                      const isCompleted = task.id == "setup-embedded" ? task.completed : (task.completed || completedTasks.includes(task.id));

                      return (
                        <Box
                          key={task.id}
                          paddingInline="200"
                          paddingBlock="200"
                          borderRadius="200"
                          background={
                            hoveredIndex === index
                              ? "bg-fill-transparent-hover"
                              : openIndex === index
                                ? "bg-fill-transparent-selected"
                                : "bg-fill-transparent"
                          }
                          onMouseEnter={() => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        >
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="300" blockAlign="center">
                              <BlockStack gap="200" >
                                <InlineStack gap="200" direction="row" align="start">
                                  <Tooltip content={isCompleted ? "Mark as not done" : "Mark as done"}>
                                    <Text>
                                      <IconSVG completed={isCompleted} onClick={() => toggleTaskCompletion(task.id)} />
                                    </Text>
                                  </Tooltip>
                                  <InlineStack gap="200" align="start">
                                    <span onClick={() => toggleSection(index)} style={{ cursor: 'pointer', fontWeight: 600 }}>
                                      <Text variant="headingMd" as="h6">{task.title}</Text>
                                    </span>
                                    {isCompleted && (
                                      <Badge tone="success" size="small">Complete</Badge>
                                    )}
                                  </InlineStack>
                                </InlineStack>

                                <Collapsible variant="bodySm" tone="subdued" open={openIndex === index} id={`collapsible-${index}`} transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}>
                                  {task.description}
                                </Collapsible>
                              </BlockStack>
                            </InlineStack>

                            <Button
                              variant={isCompleted ? "secondary" : "primary"}
                              onClick={() => {
                                if (!isCompleted && !task.completed) {
                                  markTaskComplete(task.id);
                                }
                                if (task.action == "Review") {
                                  handleReviewRequest();
                                } else {
                                  if (task.url.startsWith('/admin/')) {
                                    window.open(`${shop.primaryDomain.url}${task.url}`, '_blank');
                                  } else {
                                    navigate(task.url);
                                  }
                                }
                              }}
                            >
                              {isCompleted ? "Review" : task.action}
                            </Button>
                          </InlineStack>
                        </Box>
                      );
                    })}
                  </BlockStack>
                </Collapsible>
              </BlockStack>
            </Card>

            <SettingsPage initialSettings={settings} submit={submit} isLoading={isLoading} app={app} />


          </BlockStack>
        </Layout.Section>
      </Layout >
    </Page >
  );
}
