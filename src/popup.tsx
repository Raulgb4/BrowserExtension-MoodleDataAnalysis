/**
 * @file popup.tsx
 * @description Entry point for rendering the Chrome extension popup interface using React.
 *  * Initializes the React root and mounts the main <App /> part to the DOM.
 *  * Ensures that the popup content is dynamically rendered inside the extension UI.
 *
 * @author Raúl García Balongo
 * @date 2025
 */
import {createRoot} from "react-dom/client";
import {App} from "./App";

const rootElement = document.getElementById("root");
if (rootElement) createRoot(rootElement).render(<App />);