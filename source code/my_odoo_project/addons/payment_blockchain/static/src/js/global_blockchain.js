// Global blockchain payment function
console.log("Loading global blockchain payment functions...");

// Ensure function is available globally
window.handleDirectBlockchainPayment = async function (button) {
  try {
    console.log("Direct blockchain payment initiated");

    // Check MetaMask
    if (!window.ethereum) {
      alert("Please install MetaMask extension to use blockchain payments!");
      return;
    }

    // Get payment details from the page
    const receiverElement = document.querySelector(".blockchain-info code");
    let receiver = receiverElement ? receiverElement.textContent.trim() : "";

    // Use fallback address if receiver is empty
    if (!receiver || receiver === "") {
      receiver = "0xa0ed868BCD213D5374117CD09Aea311Cc4DcdC9b"; // Address from your practice file
      console.log("Using fallback receiver address:", receiver);
    }

    console.log("Receiver address:", receiver);

    // Get order reference and amount (try multiple selectors)
    let reference = null;
    let orderAmount = 0;

    // Try to find reference from various sources
    const refSelectors = [
      'input[name="reference"]',
      "[data-reference]",
      '.o_payment_form input[name="reference"]',
    ];

    for (const selector of refSelectors) {
      const refElement = document.querySelector(selector);
      if (refElement) {
        reference =
          refElement.value || refElement.getAttribute("data-reference");
        if (reference) break;
      }
    }

    // Try to find amount from order total
    const amountSelectors = [
      'input[name="amount"]',
      "[data-amount]",
      '.o_payment_form input[name="amount"]',
      ".oe_currency_value",
      ".o_total_row .oe_currency_value", // Order total
    ];

    for (const selector of amountSelectors) {
      const amountElement = document.querySelector(selector);
      if (amountElement) {
        let amountText =
          amountElement.value ||
          amountElement.getAttribute("data-amount") ||
          amountElement.textContent;

        // Parse amount (remove currency symbols)
        orderAmount = parseFloat(
          amountText.replace(/[^\d.,]/g, "").replace(",", ".")
        );
        if (orderAmount) break;
      }
    }

    console.log("Payment details:", { reference, orderAmount, receiver });

    if (!reference) {
      // Generate a temporary reference if not found
      reference = "BC-" + Date.now();
      console.log("Generated reference:", reference);
    }

    // Convert order amount to ETH (realistic conversion rate)
    // For demo: 1 VND = 0.000001 ETH (1,000,000 VND = 1 ETH)
    let ethAmount = orderAmount * 0.000001;

    console.log(`Converting ${orderAmount} VND to ${ethAmount} ETH`);

    // Show conversion to user before confirming
    const confirmPayment = confirm(
      `💰 Payment Confirmation:\n` +
        `Order Total: ${orderAmount} VND\n` +
        `ETH Amount: ${ethAmount} ETH\n` +
        `Network: Ganache Local (Chain 1337)\n` +
        `Receiver: ${receiver}\n\n` +
        `⚠️ This will deduct ${ethAmount} ETH from your MetaMask wallet!\n\n` +
        `Click OK to proceed with real blockchain payment.`
    );

    if (!confirmPayment) {
      button.disabled = false;
      button.innerHTML = '<i class="fa fa-ethereum me-2"></i>Pay with MetaMask';
      return;
    }

    // Disable button during processing
    button.disabled = true;
    button.innerHTML =
      '<i class="fa fa-spinner fa-spin me-2"></i>Processing...';

    // Ensure correct network (Ganache)
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x539" }], // 1337 in hex
      });
    } catch (switchError) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x539",
              chainName: "Ganache Local",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["http://127.0.0.1:7545"],
            },
          ],
        });
      }
    }

    // Request MetaMask connection
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    console.log("MetaMask connected:", accounts[0]);

    // REAL TRANSACTION - This will actually transfer ETH!
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: accounts[0],
          to: receiver,
          value: "0x" + Math.floor(ethAmount * Math.pow(10, 18)).toString(16), // Convert ETH to Wei in hex
          gas: "0x5208", // 21000 gas limit
          gasPrice: "0x09184e72a000", // 10 Gwei
        },
      ],
    });

    console.log("REAL Transaction successful:", txHash);

    // Show success message with real transaction
    alert(
      `🎉 REAL Blockchain Payment Successful!\n💰 Amount: ${ethAmount} ETH\n📋 Transaction Hash: ${txHash}\n🔍 Check your MetaMask - balance should decrease!`
    );

    // Test simple route first
    window.location.href = "/blockchain/confirm";
  } catch (error) {
    console.error("Blockchain payment failed:", error);
    alert("Payment failed: " + (error.message || "Unknown error"));

    // Re-enable button
    button.disabled = false;
    button.innerHTML = '<i class="fa fa-ethereum me-2"></i>Pay with MetaMask';
  }
};

console.log(
  "Global blockchain payment function registered:",
  typeof window.handleDirectBlockchainPayment
);

// Auto-calculate and display ETH amount when page loads
window.addEventListener("DOMContentLoaded", function () {
  setTimeout(function () {
    const conversionDisplay = document.getElementById("conversion-display");
    if (!conversionDisplay) return;

    // Try to find order amount
    const amountSelectors = [
      ".oe_currency_value",
      ".o_total_row .oe_currency_value",
      "[data-amount]",
    ];

    let orderAmount = 0;
    for (const selector of amountSelectors) {
      const amountElement = document.querySelector(selector);
      if (amountElement) {
        let amountText =
          amountElement.textContent ||
          amountElement.getAttribute("data-amount");
        orderAmount = parseFloat(
          amountText.replace(/[^\d.,]/g, "").replace(",", ".")
        );
        if (orderAmount) break;
      }
    }

    if (orderAmount > 0) {
      // Same conversion logic as payment function
      let ethAmount = orderAmount * 0.000001;
      if (ethAmount < 0.0001) {
        ethAmount = 0.0001;
      }

      conversionDisplay.innerHTML = `
        <span class="fw-bold">${orderAmount} VND</span> = 
        <span class="fw-bold text-primary">${ethAmount} ETH</span>
        ${
          ethAmount === 0.0001
            ? '<small class="text-muted">(minimum amount)</small>'
            : ""
        }
      `;
    } else {
      conversionDisplay.textContent =
        "Amount will be calculated at payment time";
    }
  }, 500); // Wait for page to fully load
});
