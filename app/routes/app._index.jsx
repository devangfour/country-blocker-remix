import {
  Card,
  Page,
  Layout,
  Button,
  Banner,
  Box,
  InlineStack,
  Text,
  ProgressBar,
  BlockStack,
  Badge
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@remix-run/react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import connectDB from "../db.server.js";
import CountryBlockerSettings from "../models/CountryBlockerSettings.js";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  await connectDB();

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "mark_embed_enabled") {
    // Update or create settings with app embed enabled
    await CountryBlockerSettings.findOneAndUpdate(
      { shop },
      { appEmbedEnabled: true },
      { upsert: true, new: true }
    );

    return json({ success: true });
  }

  if (action === "mark_embed_disabled") {
    // Update or create settings with app embed disabled
    await CountryBlockerSettings.findOneAndUpdate(
      { shop },
      { appEmbedEnabled: false },
      { upsert: true, new: true }
    );

    return json({ success: true });
  }

  return json({ success: false });
}

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  await connectDB();

  // Get shop info
  const { admin } = await authenticate.admin(request);
  const shopResponse = await admin.graphql(`
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

  const shopData = await shopResponse.json();

  // Get settings from database to check app embed status
  const settings = await CountryBlockerSettings.findOne({ shop });

  return json({
    shop: shopData.data.shop,
    appEmbedEnabled: settings?.appEmbedEnabled || false,
  });
}

export default function Index() {
  const { shop, appEmbedEnabled } = useLoaderData();
  const navigate = useNavigate();

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
  }, [appEmbedEnabled, completedTasks, navigate]);

  // Save progress to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("country-blocker-progress", JSON.stringify(completedTasks));
    }
  }, [completedTasks]);

  const markTaskComplete = useCallback((taskId) => {
    setCompletedTasks(prev => [...prev, taskId]);
  }, []);

  // Check if app embed is enabled
  const hasEnabledEmbed = appEmbedEnabled;
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
        : `/admin/themes/current/editor?addAppBlockId=country-blocker&target=appEmbeds`,
      required: true,
      completed: hasEnabledEmbed,
    },
    {
      id: "configure-settings",
      title: "Configure Country Blocking",
      description: "Set up which countries to block and customize the block message",
      action: "Configure",
      url: "/app/settings",
      required: true,
    }
  ];

  const completedCount = tasks.filter(task => task.completed || completedTasks.includes(task.id)).length;
  const progressPercentage = (completedCount / tasks.length) * 100;

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
            {!shouldRedirect && (
              <Banner
                title="Welcome to Country Blocker"
                status="info"
              >
                <p>
                  Protect your store by blocking access from specific countries.
                  Get started by configuring your blocking settings below.
                </p>
              </Banner>
            )}

            {/* Progress Card */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">
                    Setup Progress
                  </Text>
                  <Badge status={completedCount === tasks.length ? "success" : "attention"}>
                    {completedCount} of {tasks.length} completed
                  </Badge>
                </InlineStack>

                <Box>
                  <ProgressBar progress={progressPercentage} size="small" />
                  <Box paddingBlockStart="200">
                    <Text variant="bodySm" tone="subdued">
                      {Math.round(progressPercentage)}% complete
                    </Text>
                  </Box>
                </Box>
              </BlockStack>
            </Card>

            {/* Development Helper - Remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">Development Helper</Text>
                  <Text variant="bodySm">
                    Database Status - App Embed Enabled: {hasEnabledEmbed ? 'Yes' : 'No'}
                  </Text>
                  <InlineStack gap="300">
                    <Button
                      variant="secondary"
                      disabled={hasEnabledEmbed}
                      onClick={async () => {
                        const formData = new FormData();
                        formData.append("action", "mark_embed_enabled");
                        const response = await fetch(window.location.href, {
                          method: "POST",
                          body: formData,
                        });
                        const result = await response.json();
                        if (result.success) {
                          window.location.reload();
                        } else {
                          alert("Failed to update database");
                        }
                      }}
                    >
                      Enable in Database
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!hasEnabledEmbed}
                      onClick={async () => {
                        const formData = new FormData();
                        formData.append("action", "mark_embed_disabled");
                        const response = await fetch(window.location.href, {
                          method: "POST",
                          body: formData,
                        });
                        const result = await response.json();
                        if (result.success) {
                          window.location.reload();
                        } else {
                          alert("Failed to update database");
                        }
                      }}
                    >
                      Disable in Database
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            )}

            {/* Setup Tasks */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Setup Tasks
                </Text>

                <BlockStack gap="300">
                  {tasks.map((task) => {
                    const isCompleted = task.completed || completedTasks.includes(task.id);

                    return (
                      <Box
                        key={task.id}
                        padding="400"
                        borderWidth="0165"
                        borderColor="border-subdued"
                        borderRadius="200"
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="300" blockAlign="center">
                            {/* <Icon
                              source={isCompleted ? CheckCircleIcon : CircleIcon}
                              tone={isCompleted ? "success" : "subdued"}
                            /> */}
                            <BlockStack gap="100">
                              <InlineStack gap="200" blockAlign="center">
                                <Text variant="bodyMd" fontWeight="semibold">
                                  {task.title}
                                </Text>
                                {task.required && (
                                  <Badge tone="critical" size="small">Required</Badge>
                                )}
                                {isCompleted && (
                                  <Badge tone="success" size="small">Complete</Badge>
                                )}
                              </InlineStack>
                              <Text variant="bodySm" tone="subdued">
                                {task.description}
                              </Text>
                            </BlockStack>
                          </InlineStack>

                          <Button
                            variant={isCompleted ? "secondary" : "primary"}
                            onClick={() => {
                              if (!isCompleted && !task.completed) {
                                markTaskComplete(task.id);
                              }
                              
                              // Handle external URLs (like admin theme editor)
                              if (task.url.startsWith('/admin/')) {
                                alert(`${shop.primaryDomain.url}${task.url}`);
                                window.open(`${shop.primaryDomain.url}${task.url}`, '_blank');
                              } else {
                                navigate(task.url);
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
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
