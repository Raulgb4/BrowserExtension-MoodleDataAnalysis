// Import Node.js core module to resolve file paths
const path = require('path');

// Import plugin to copy static files from "public" to the output directory
const CopyPlugin = require('copy-webpack-plugin');

// Export Webpack configuration
module.exports = {
    // Set build mode to production for optimizations (minification, etc.)
    mode: "production",

    // Define the entry points of the application
    entry: {
        popup: path.resolve(__dirname, "src/popup.tsx") // Will compile to dist/popup.js
    },

    // Specify the output configuration
    output: {
        path: path.resolve(__dirname, "dist"), // Output directory for compiled files
        filename: "[name].js", // Uses the key from 'entry' (e.g., popup -> popup.js)
        clean: true // Clears the dist folder before building
    },

    // Resolve file extensions when importing modules
    resolve: {
        extensions: [".ts", ".js", ".tsx", ".jsx"]
    },

    // Define how to process different types of modules
    module: {
        rules: [
            {
                // Use ts-loader to handle .ts and .tsx files (TypeScript)
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/ // Skip dependencies
            },
            {
                // Handle .css files using CSS and style loaders
                test: /\.css$/i,
                use: ["style-loader", "css-loader"], // Injects CSS into DOM and resolves imports
            },
        ]
    },

    // Use plugins to extend Webpack's functionality
    plugins: [
        new CopyPlugin({
            patterns: [
                // Copy all files from 'public/' directly into the output folder
                { from: "public", to: "." }
            ]
        })
    ],

    performance: {
        maxAssetSize: 1500000,
        maxEntrypointSize: 1500000,
    },
}
