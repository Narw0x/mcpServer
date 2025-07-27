import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "./lib/supabase.js";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

function capitalizeFirstLetter(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

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

interface DeleteItemParams {
    id: string;
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

// Define interface for the tool response
interface ToolResponse {
    content: Array<{
        type: "text";
        text: string;
    }>;
}

// Store tool handlers
const toolHandlers: { [key: string]: (params: any) => Promise<ToolResponse> } = {};

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

// Add Item Tool
toolHandlers["addItem"] = async ({ item }: AddItemParams): Promise<ToolResponse> => {
    try {
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

        const currentConfig: State = data.config || { pages: [], sidebar: [] };

        const sidebarItem: SidebarItem = {
            id: item.id.toLowerCase(),
            label: item.label ?? capitalizeFirstLetter(item.id),
            active: item.active ?? false,
        };

        const pageItem: Page = {
            id: item.id.toLowerCase(),
            title: item.title ?? `Page ${item.id}`,
            content: item.content ?? "",
        };

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

        currentConfig.sidebar.push(sidebarItem);
        currentConfig.pages.push(pageItem);

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
};

//@ts-ignore
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
    toolHandlers["addItem"]
);

// Delete Item Tool
toolHandlers["deleteItem"] = async ({ id }: DeleteItemParams): Promise<ToolResponse> => {
    try {
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

        const currentConfig: State = data.config || { pages: [], sidebar: [] };

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

        const deletedSidebarItem = sidebarIndex !== -1 ? currentConfig.sidebar[sidebarIndex] : null;
        const deletedPageItem = pageIndex !== -1 ? currentConfig.pages[pageIndex] : null;

        if (sidebarIndex !== -1) {
            currentConfig.sidebar.splice(sidebarIndex, 1);
        }
        if (pageIndex !== -1) {
            currentConfig.pages.splice(pageIndex, 1);
        }

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
};

//@ts-ignore
server.tool(
    "deleteItem",
    "Delete an item from both sidebar and pages",
    {
        id: z.string().describe("Unique identifier of the item to delete"),
    },
    toolHandlers["deleteItem"]
);

// Update Item Tool
toolHandlers["updateItem"] = async ({ oldId, newItem }: UpdateItemParams): Promise<ToolResponse> => {
    try {
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

        const currentConfig: State = data.config || { pages: [], sidebar: [] };

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

        const originalSidebarItem = sidebarIndex !== -1 ? { ...currentConfig.sidebar[sidebarIndex] } : null;
        const originalPageItem = pageIndex !== -1 ? { ...currentConfig.pages[pageIndex] } : null;

        if (sidebarIndex !== -1) {
            currentConfig.sidebar[sidebarIndex] = {
                id: newItem.id?.toLowerCase() || oldId,
                label: newItem.label || capitalizeFirstLetter(newItem.id || oldId),
                active: newItem.active ?? false,
            };
        }

        if (pageIndex !== -1) {
            currentConfig.pages[pageIndex] = {
                id: newItem.id?.toLowerCase() || oldId,
                title: newItem.title || `Page ${newItem.id || oldId}`,
                content: newItem.content || `Welcome to the page ${newItem.id || oldId}`,
            };
        }

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
};

//@ts-ignore
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
    toolHandlers["updateItem"]
);

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Validate input with Zod schemas
const addItemSchema = z.object({
    item: z.object({
        id: z.string(),
        label: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
        active: z.boolean().optional(),
    }),
});

const deleteItemSchema = z.object({
    id: z.string(),
});

const updateItemSchema = z.object({
    oldId: z.string(),
    newItem: z.object({
        id: z.string().optional(),
        label: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
        active: z.boolean().optional(),
    }),
});

// Expose tools via HTTP endpoints
app.post("/api/addItem", async (req, res) => {
    try {
        const validatedData = addItemSchema.parse(req.body);
        const result = await toolHandlers["addItem"](validatedData);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({
            content: [
                {
                    type: "text",
                    text: `Error executing addItem: ${error.message}`,
                },
            ],
        });
    }
});

app.post("/api/deleteItem", async (req, res) => {
    try {
        const validatedData = deleteItemSchema.parse(req.body);
        const result = await toolHandlers["deleteItem"](validatedData);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({
            content: [
                {
                    type: "text",
                    text: `Error executing deleteItem: ${error.message}`,
                },
            ],
        });
    }
});

app.post("/api/updateItem", async (req, res) => {
    try {
        const validatedData = updateItemSchema.parse(req.body);
        const result = await toolHandlers["updateItem"](validatedData);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({
            content: [
                {
                    type: "text",
                    text: `Error executing updateItem: ${error.message}`,
                },
            ],
        });
    }
});

// Get current config
app.get("/api/config", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("configs")
            .select("config")
            .single();

        if (error) {
            res.status(500).json({
                content: [
                    {
                        type: "text",
                        text: `Failed to load config from database: ${error.message}`,
                    },
                ],
            });
        } else {
            res.json(data.config || { pages: [], sidebar: [] });
        }
    } catch (error: any) {
        res.status(500).json({
            content: [
                {
                    type: "text",
                    text: `Error fetching config: ${error.message}`,
                },
            ],
        });
    }
});

// Start the server
async function main(): Promise<void> {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`CMS MCP Server running on http://localhost:${port}`);
    });
}

main().catch((error: any) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});