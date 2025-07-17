"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
var supabase_js_1 = require("@supabase/supabase-js");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var url_1 = require("url");
// Get the directory name for ES modules
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
// Load environment variables with explicit path
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
// Debug: Log the current working directory and __dirname
console.error('Current working directory:', process.cwd());
console.error('__dirname:', __dirname);
console.error('Looking for .env at:', path_1.default.resolve(__dirname, '../../.env'));
// Add error checking and fallback values
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
// Debug: Log loaded environment variables
console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
console.error('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set');
if (!supabaseUrl) {
    console.error('Error: SUPABASE_URL environment variable is not set');
    console.error('Please check your .env file and ensure SUPABASE_URL is defined');
    process.exit(1);
}
if (!supabaseAnonKey) {
    console.error('Error: SUPABASE_ANON_KEY environment variable is not set');
    console.error('Please check your .env file and ensure SUPABASE_ANON_KEY is defined');
    process.exit(1);
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
