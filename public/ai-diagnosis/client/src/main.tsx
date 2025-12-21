import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Hide Replit dev banner
function hideBanner() {
  // Try to find and hide the banner element by its characteristics
  const bannerElements = document.querySelectorAll('[style*="rgb(6, 182, 212)"], [style*="rgb(59, 130, 246)"]');
  bannerElements.forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });
  
  // Also try to find by text content
  const allDivs = document.querySelectorAll('div');
  allDivs.forEach(div => {
    if (div.textContent?.includes('temporary development preview') || div.textContent?.includes('Deploy your app')) {
      (div as HTMLElement).style.display = 'none';
    }
  });
  
  // Hide any top sticky elements that aren't part of the app
  const stickyElements = document.querySelectorAll('[style*="position: sticky"]');
  stickyElements.forEach(el => {
    if ((el as HTMLElement).offsetTop < 100) {
      (el as HTMLElement).style.display = 'none';
    }
  });
}

// Run on load and periodically check
window.addEventListener('load', hideBanner);
hideBanner();
setInterval(hideBanner, 500);

createRoot(document.getElementById("root")!).render(<App />);
