import { createRoot } from "react-dom/client";
import Home from "../../app/routes/home";

const mount = document.getElementById("root");

if (!mount) {
  throw new Error("Popup root element not found.");
}

document.body.style.margin = "0";
document.body.style.minWidth = "420px";
document.body.style.minHeight = "520px";
document.body.style.background = "#ffffff";

createRoot(mount).render(<Home />);
