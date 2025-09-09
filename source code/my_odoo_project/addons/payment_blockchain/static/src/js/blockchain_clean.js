console.log("Blockchain payment script loaded");

// Simple function to handle blockchain payment
function handleBlockchainPayment() {
  console.log("Blockchain payment button clicked!");

  if (!window.ethereum) {
    alert("Please install MetaMask!");
    return;
  }

  // Simple test - just show MetaMask
  window.ethereum
    .request({ method: "eth_requestAccounts" })
    .then(function (accounts) {
      alert("MetaMask connected! Account: " + accounts[0]);
      console.log("Connected account:", accounts[0]);
    })
    .catch(function (error) {
      alert("Error: " + error.message);
      console.error("Error:", error);
    });
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, looking for blockchain button...");

  // Find the button and add click handler
  setTimeout(function () {
    const button = document.querySelector("button");
    const buttons = document.querySelectorAll("button");

    console.log("Found buttons:", buttons.length);

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      if (btn.textContent.includes("MetaMask")) {
        console.log("Found MetaMask button!");
        btn.onclick = handleBlockchainPayment;
        btn.style.border = "3px solid red"; // Visual confirmation
        break;
      }
    }
  }, 1000);
});

// Also try immediately
setTimeout(function () {
  const buttons = document.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    if (btn.textContent.includes("MetaMask")) {
      console.log("Found MetaMask button (immediate)!");
      btn.onclick = handleBlockchainPayment;
      btn.style.border = "3px solid red";
      break;
    }
  }
}, 2000);
