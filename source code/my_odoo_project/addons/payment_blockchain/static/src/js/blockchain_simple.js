/** Simple blockchain payment handler with debug */
(function () {
  "use strict";

  console.log("Blockchain JS loading...");

  // Try multiple approaches to initialize
  setTimeout(function() {
    initBlockchainPayment();
  }, 1000);

  document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM ready, initializing blockchain...");
    initBlockchainPayment();
  });

  // Also try to init immediately
  initBlockchainPayment();

  function initBlockchainPayment() {
    console.log("Looking for blockchain button...");
    
    // Try multiple selectors
    const selectors = [
      ".o-pay-with-blockchain",
      "button:contains('Pay with MetaMask')",
      "[class*='pay-with-blockchain']",
      "button[class*='pay']"
    ];
    
    let button = null;
    for (let selector of selectors) {
      try {
        button = document.querySelector(selector);
        if (button) {
          console.log("Found button with selector:", selector);
          break;
        }
      } catch (e) {
        // Ignore selector errors
      }
    }
    
    // If still no button, try finding by text
    if (!button) {
      const buttons = document.querySelectorAll('button');
      for (let btn of buttons) {
        if (btn.textContent.includes('MetaMask')) {
          button = btn;
          console.log("Found button by text content");
          break;
        }
      }
    }
    
    if (button && !button.hasAttribute("data-blockchain-initialized")) {
      button.setAttribute("data-blockchain-initialized", "true");
      button.addEventListener("click", handleBlockchainPayment);
      console.log("Blockchain payment button initialized successfully!");
      
      // Change button style to confirm it's working
      button.style.border = "2px solid green";
    } else if (!button) {
      console.log("Blockchain button not found!");
      console.log("Available buttons:", document.querySelectorAll('button'));
    }
  }

  function handleBlockchainPayment(event) {
    event.preventDefault();
    console.log("=== Blockchain payment button clicked! ===");
    alert("Blockchain payment clicked! Check console for details.");
    
    // Basic MetaMask test
    if (window.ethereum) {
      console.log("MetaMask detected!");
      alert("MetaMask detected! Ready to process payment.");
    } else {
      console.log("MetaMask not found!");
      alert("Please install MetaMask!");
    }
  }

  // Re-run initialization periodically
  setInterval(initBlockchainPayment, 2000);

})();

    try {
      // Check MetaMask
      if (!window.ethereum) {
        alert("Vui lòng cài đặt MetaMask!");
        return;
      }

      // Get receiver address
      const receiverCode = document.querySelector("code");
      const receiver = receiverCode
        ? receiverCode.textContent.trim()
        : "0xE487403f900e36F4Fd88cDe35d1d9335f0a64bd0";

      console.log("Receiver:", receiver);

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      console.log("Connected account:", accounts[0]);

      // Send transaction (0.001 ETH for demo)
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: accounts[0],
            to: receiver,
            value: "0x38D7EA4C68000", // 0.001 ETH in Wei
          },
        ],
      });

      alert(`Giao dịch thành công! TX hash: ${txHash}`);
      console.log("Transaction hash:", txHash);
    } catch (error) {
      console.error("Error:", error);
      alert(`Lỗi: ${error.message}`);
    }
  }

  // Re-initialize when page content changes (for dynamic content)
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length) {
        setTimeout(initBlockchainPayment, 100);
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
