import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { supabase } from "./lib/supabase.js";

// Define interfaces for the schema
interface Page {
    id: string;
    title: string;
    content: string;
}

interface SidebarItem {
    id: string;
    label: string;
    active: boolean;
}

interface State {
    pages: Page[];
    sidebar: SidebarItem[];
}

// Define interface for the tool parameters
interface AddItemParams {
    item: {
        id: string;
        label?: string;
        title?: string;
        content?: string;
        active?: boolean;
    };
}
// Define interface for the tool parameters
interface DeleteItemParams {
    id: string;
}

// Define interface for the tool response
interface ToolResponse {
    content: Array<{
        type: "text";
        text: string;
    }>;
}

interface UpdateItemParams {
    oldId: string;
    newItem: {
        id?: string;
        label?: string;
        title?: string;
        content?: string;
        active?: boolean;
    };
}

const server = new McpServer({
    name: "Cms Application",
    version: "1.0.0",
    description: "A server for managing page data",
    schema: z.object({
        pages: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                content: z.string(),
            })
        ),
        sidebar: z.array(
            z.object({
                id: z.string(),
                label: z.string(),
                active: z.boolean(),
            })
        ),
    }),
});

// @ts-ignore
server.tool(
    "addItem",
    "Add a new item to both sidebar and pages",
    {
        item: z.object({
            id: z.string().describe("Unique identifier for the item"),
            label: z.string().optional().describe("Label for sidebar item (optional)"),
            title: z.string().optional().describe("Title for page item (optional)"),
            content: z.string().optional().describe("Content for page item (optional)"),
            active: z.boolean().optional().describe("Active status for sidebar item (optional)"),
        }),
    },
    async ({ item }: AddItemParams): Promise<ToolResponse> => {
        try {
            // Load current config from Supabase
            const { data, error } = await supabase
                .from("configs")
                .select("config")
                .single();

            if (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to load config from database: ${error.message}`,
                        },
                    ],
                };
            }

            // Parse the current config
            const currentConfig: State = data.config || { pages: [], sidebar: [] };

            // Validate sidebar item
            const sidebarItem: SidebarItem = {
                id: item.id,
                label: item.label ?? `Item ${item.id}`,
                active: item.active ?? false,
            };

            // Validate page item
            const pageItem: Page = {
                id: item.id,
                title: item.title ?? `Page ${item.id}`,
                content: item.content ?? "",
            };

            // Check for duplicate IDs in both arrays
            if (currentConfig.sidebar.some((existing: SidebarItem) => existing.id === item.id)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to add item: Sidebar item with ID ${item.id} already exists`,
                        },
                    ],
                };
            }
            if (currentConfig.pages.some((existing: Page) => existing.id === item.id)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to add item: Page with ID ${item.id} already exists`,
                        },
                    ],
                };
            }

            // Add to both sidebar and pages
            currentConfig.sidebar.push(sidebarItem);
            currentConfig.pages.push(pageItem);

            // Update the config in Supabase where id = 1
            const { error: updateError } = await supabase
                .from("configs")
                .update({ config: currentConfig })
                .eq("id", 1);

            if (updateError) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to update config in database: ${updateError.message}`,
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully added item with ID ${item.id} to both sidebar and pages and updated database:\n` +
                            `Sidebar Item:\n${JSON.stringify(sidebarItem, null, 2)}\n` +
                            `Page:\n${JSON.stringify(pageItem, null, 2)}`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to add item: ${error.message}`,
                    },
                ],
            };
        }
    }
);
// @ts-ignore
server.tool(
    "deleteItem",
    "Delete an item from both sidebar and pages",
    {
        id: z.string().describe("Unique identifier of the item to delete"),
    },
    async ({ id }: DeleteItemParams): Promise<ToolResponse> => {
        try {
            // Load current config from Supabase
            const { data, error } = await supabase
                .from("configs")
                .select("config")
                .single();

            if (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to load config from database: ${error.message}`,
                        },
                    ],
                };
            }

            // Parse the current config
            const currentConfig: State = data.config || { pages: [], sidebar: [] };

            // Check if item exists
            const sidebarIndex = currentConfig.sidebar.findIndex((item: SidebarItem) => item.id === id);
            const pageIndex = currentConfig.pages.findIndex((item: Page) => item.id === id);

            if (sidebarIndex === -1 && pageIndex === -1) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Item with ID ${id} not found in either sidebar or pages`,
                        },
                    ],
                };
            }

            // Store items for response before deletion
            const deletedSidebarItem = sidebarIndex !== -1 ? currentConfig.sidebar[sidebarIndex] : null;
            const deletedPageItem = pageIndex !== -1 ? currentConfig.pages[pageIndex] : null;

            // Remove items if they exist
            if (sidebarIndex !== -1) {
                currentConfig.sidebar.splice(sidebarIndex, 1);
            }
            if (pageIndex !== -1) {
                currentConfig.pages.splice(pageIndex, 1);
            }

            // Update the config in Supabase
            const { error: updateError } = await supabase
                .from("configs")
                .update({ config: currentConfig })
                .eq("id", 1);

            if (updateError) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to update config in database: ${updateError.message}`,
                        },
                    ],
                };
            }

            // Create response message
            let responseText = `Successfully deleted item with ID ${id}`;
            if (deletedSidebarItem) {
                responseText += `\nDeleted Sidebar Item:\n${JSON.stringify(deletedSidebarItem, null, 2)}`;
            }
            if (deletedPageItem) {
                responseText += `\nDeleted Page:\n${JSON.stringify(deletedPageItem, null, 2)}`;
            }

            return {
                content: [
                    {
                        type: "text",
                        text: responseText,
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to delete item: ${error.message}`,
                    },
                ],
            };
        }
    }
);

// @ts-ignore
server.tool(
    "updateItem",
    "Update an existing item in both sidebar and pages",
    {
        oldId: z.string().describe("Unique identifier of the item to update"),
        newItem: z.object({
            id: z.string().optional().describe("New unique identifier for the item (optional)"),
            label: z.string().optional().describe("New label for sidebar item (optional)"),
            title: z.string().optional().describe("New title for page item (optional)"),
            content: z.string().optional().describe("New content for page item (optional)"),
            active: z.boolean().optional().describe("New active status for sidebar item (optional)"),
        }),
    },
    async ({ oldId, newItem }: UpdateItemParams): Promise<ToolResponse> => {
        try {
            // Load current config from Supabase
            const { data, error } = await supabase
                .from("configs")
                .select("config")
                .single();

            if (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to load config from database: ${error.message}`,
                        },
                    ],
                };
            }

            // Parse the current config
            const currentConfig: State = data.config || { pages: [], sidebar: [] };

            // Find existing items
            const sidebarIndex = currentConfig.sidebar.findIndex((item: SidebarItem) => item.id === oldId);
            const pageIndex = currentConfig.pages.findIndex((item: Page) => item.id === oldId);

            if (sidebarIndex === -1 && pageIndex === -1) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Item with ID ${oldId} not found in either sidebar or pages`,
                        },
                    ],
                };
            }

            // Check for duplicate ID if new ID is provided
            if (newItem.id && newItem.id !== oldId) {
                if (currentConfig.sidebar.some((item: SidebarItem) => item.id === newItem.id) ||
                    currentConfig.pages.some((item: Page) => item.id === newItem.id)) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Failed to update item: New ID ${newItem.id} already exists`,
                            },
                        ],
                    };
                }
            }

            // Store original items for response
            const originalSidebarItem = sidebarIndex !== -1 ? { ...currentConfig.sidebar[sidebarIndex] } : null;
            const originalPageItem = pageIndex !== -1 ? { ...currentConfig.pages[pageIndex] } : null;

            // Update sidebar item if it exists
            if (sidebarIndex !== -1) {
                currentConfig.sidebar[sidebarIndex] = {
                    id: newItem.id ?? currentConfig.sidebar[sidebarIndex].id,
                    label: newItem.label ?? currentConfig.sidebar[sidebarIndex].label,
                    active: newItem.active ?? currentConfig.sidebar[sidebarIndex].active,
                };
            }

            // Update page item if it exists
            if (pageIndex !== -1) {
                currentConfig.pages[pageIndex] = {
                    id: newItem.id ?? currentConfig.pages[pageIndex].id,
                    title: newItem.title ?? currentConfig.pages[pageIndex].title,
                    content: newItem.content ?? currentConfig.pages[pageIndex].content,
                };
            }

            // Update the config in Supabase
            const { error: updateError } = await supabase
                .from("configs")
                .update({ config: currentConfig })
                .eq("id", 1);

            if (updateError) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to update config in database: ${updateError.message}`,
                        },
                    ],
                };
            }

            // Create response message
            let responseText = `Successfully updated item with ID ${oldId}`;
            if (originalSidebarItem) {
                responseText += `\nUpdated Sidebar Item:\nFrom: ${JSON.stringify(originalSidebarItem, null, 2)}\nTo: ${JSON.stringify(currentConfig.sidebar[sidebarIndex], null, 2)}`;
            }
            if (originalPageItem) {
                responseText += `\nUpdated Page:\nFrom: ${JSON.stringify(originalPageItem, null, 2)}\nTo: ${JSON.stringify(currentConfig.pages[pageIndex], null, 2)}`;
            }

            return {
                content: [
                    {
                        type: "text",
                        text: responseText,
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to update item: ${error.message}`,
                    },
                ],
            };
        }
    }
);

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("CMS MCP Server running on stdio");
}

main().catch((error: any) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});