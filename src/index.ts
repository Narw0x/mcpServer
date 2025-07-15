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

// Define interface for the tool response
interface ToolResponse {
    content: Array<{
        type: "text";
        text: string;
    }>;
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

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("CMS MCP Server running on stdio");
}

main().catch((error: any) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});