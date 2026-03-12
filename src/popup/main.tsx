import { createRoot } from "react-dom/client";
import PopupApp from "./PopupApp";

const mount = document.getElementById("root");

if (!mount) {
  throw new Error("Popup root element not found.");
}

document.body.style.margin = "0";
document.body.style.minWidth = "360px";
document.body.style.minHeight = "300px";
document.body.style.background = "#ffffff";

createRoot(mount).render(<PopupApp />);
