import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import './firebase'; // Initialize Firebase

console.log("MAIN TSX FILE EXECUTING - VITE IS SERVING JS");

const rootEl = document.getElementById("root");
if (!rootEl) {
    console.error("CRITICAL ERROR: 'root' element not found in index.html");
    document.body.innerHTML = "<h1 style='color:red;font-size:30px'>FATAL: Root element missing</h1>";
} else {
    try {
        createRoot(rootEl).render(<App />);
        console.log("React Render Initiated");
    } catch (e) {
        console.error("FATAL REACT RENDER ERROR:", e);
        rootEl.innerHTML = `<h1 style='color:red'>Render Crash: ${e}</h1>`;
    }
}
