import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

function capitalizeFirstLetter(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Define interfaces for the schema
interface Page {
    id: string;
    title: string;
}

interface SidebarItem {
    id: string;
    label: string;
}

interface State {
    pages: Page[];
    sidebar: SidebarItem[];
}

// Define interface for the tool parameters
interface AddItemParams {
    config: State;
    item: {
        id: string;
        label?: string;
        title?: string;
    };
}

// Define Zod schema for input validation
const addItemSchema = {
    config: z.object({
        pages: z.array(z.object({ id: z.string(), title: z.string() })),
        sidebar: z.array(z.object({ id: z.string(), label: z.string() })),
    }).describe("Current configuration state"),
    item: z.object({
        id: z.string().describe("Unique identifier for the item"),
        label: z.string().optional().describe("Label for sidebar item (optional)"),
        title: z.string().optional().describe("Title for page item (optional)"),
    }),
};

// Initialize McpServer
const server = new McpServer({
    name: "Cms Application",
    version: "1.0.0",
    description: "A server for managing page data",
    schema: z.object({
        pages: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
            })
        ),
        sidebar: z.array(
            z.object({
                id: z.string(),
                label: z.string(),
            })
        ),
    }),
});

// Register tools with McpServer
server.tool(
    "addItem",
    "Add a new item to both sidebar and pages",
    addItemSchema,
    async (args: any) => {
        try {
            const validatedData = z.object(addItemSchema).parse(args) as AddItemParams;
            const currentConfig: State = validatedData.config || { pages: [], sidebar: [] };

            const sidebarItem: SidebarItem = {
                id: validatedData.item.id.toLowerCase(),
                label: validatedData.item.label ?? capitalizeFirstLetter(validatedData.item.id),
            };

            const pageItem: Page = {
                id: validatedData.item.id.toLowerCase(),
                title: validatedData.item.title ?? `Page ${validatedData.item.id}`,
            };

            if (currentConfig.sidebar.some((existing: SidebarItem) => existing.id === validatedData.item.id)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to add item: Sidebar item with ID ${validatedData.item.id} already exists`,
                        },
                    ],
                };
            }
            if (currentConfig.pages.some((existing: Page) => existing.id === validatedData.item.id)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to add item: Page with ID ${validatedData.item.id} already exists`,
                        },
                    ],
                };
            }

            const updatedConfig = {
                ...currentConfig,
                sidebar: [...currentConfig.sidebar, sidebarItem],
                pages: [...currentConfig.pages, pageItem],
            };

            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully added item with ID ${validatedData.item.id} to both sidebar and pages:\n` +
                            `Sidebar Item:\n${JSON.stringify(sidebarItem, null, 2)}\n` +
                            `Page:\n${JSON.stringify(pageItem, null, 2)}`,
                    },
                ],
                updatedConfig,
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

// Start the server with StdioServerTransport
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Cms MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});