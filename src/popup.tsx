/**
 * @file popup.tsx
 * @description Entry point for rendering the Chrome extension popup interface using React.
 * Initializes the React root and mounts the main <App /> component into the DOM.
 * This ensures the popup content is dynamically rendered inside the extension UI.
 *
 * @author Raúl García Balongo
 * @date 2025
 */
import {createRoot} from "react-dom/client";
import {App} from "./App";

const rootElement = document.getElementById("root");

if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App/>);
}
