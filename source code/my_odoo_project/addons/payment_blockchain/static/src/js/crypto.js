/**
 * Blockchain Payment Integration with MetaMask
 * Handles cryptocurrency payments using ethers.js
 */

(function () {
  "use strict";

  // Wait for DOM to be ready
  document.addEventListener("DOMContentLoaded", function () {
    initBlockchainPayment();
  });

  function initBlockchainPayment() {
    const payButtons = document.querySelectorAll("#pay-with-crypto");

    payButtons.forEach(function (button) {
      button.addEventListener("click", handleCryptoPayment);
    });
  }

  async function handleCryptoPayment(event) {
    const button = event.target;
    const orderId = button.getAttribute("data-order-id");
    const amount = parseFloat(button.getAttribute("data-amount"));
    const acquirerId = button.getAttribute("data-acquirer-id");

    if (!orderId || !amount) {
      showError("Missing order information");
      return;
    }

    try {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        showError(
          "MetaMask is not installed. Please install MetaMask browser extension."
        );
        return;
      }

      showStatus("Connecting to MetaMask...", "info");

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        showError("No MetaMask accounts found. Please connect your wallet.");
        return;
      }

      const userAccount = accounts[0];
      console.log("Connected account:", userAccount);

      // Get blockchain configuration
      const config = await getBlockchainConfig();
      if (!config || config.error) {
        showError(
          "Failed to get payment configuration: " +
            (config?.error || "Unknown error")
        );
        return;
      }

      // Check network
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      const currentChainId = parseInt(chainId, 16);

      if (currentChainId !== config.network_chain_id) {
        showError(
          `Please switch to the correct network. Expected Chain ID: ${config.network_chain_id}, Current: ${currentChainId}`
        );
        return;
      }

      // Convert amount to Wei (assuming ETH payment)
      // Note: You might want to implement proper price conversion here
      const amountInWei = Math.floor(amount * 1e18).toString(16);

      showStatus("Preparing transaction...", "info");

      // Prepare transaction
      const transactionParams = {
        from: userAccount,
        to: config.merchant_wallet_address,
        value: "0x" + amountInWei,
        gas: "0x5208", // 21000 gas for simple transfer
      };

      console.log("Transaction params:", transactionParams);

      showStatus("Please confirm the transaction in MetaMask...", "warning");

      // Send transaction
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [transactionParams],
      });

      console.log("Transaction sent:", txHash);
      showStatus("Transaction sent! Hash: " + txHash, "success");

      // Send transaction hash to backend
      const result = await sendTransactionToBackend(orderId, txHash);

      if (result.success) {
        showStatus(
          "Payment submitted successfully! The transaction will be verified on-chain.",
          "success"
        );

        // Start polling for transaction status
        pollTransactionStatus(orderId, txHash);
      } else {
        showError(
          "Failed to register transaction: " + (result.error || "Unknown error")
        );
      }
    } catch (error) {
      console.error("Payment error:", error);

      if (error.code === 4001) {
        showError("Transaction was rejected by user.");
      } else if (error.code === -32603) {
        showError(
          "Transaction failed. Please check your wallet balance and try again."
        );
      } else {
        showError("Payment failed: " + (error.message || error));
      }
    }
  }

  async function getBlockchainConfig() {
    try {
      const response = await fetch("/payment/blockchain/config", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      return await response.json();
    } catch (error) {
      console.error("Error getting blockchain config:", error);
      return { error: "Network error" };
    }
  }

  async function sendTransactionToBackend(orderId, txHash) {
    try {
      const response = await fetch("/payment/blockchain/tx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: orderId,
          tx_hash: txHash,
        }),
      });
      return await response.json();
    } catch (error) {
      console.error("Error sending transaction to backend:", error);
      return { error: "Network error" };
    }
  }

  async function pollTransactionStatus(orderId, txHash) {
    const maxAttempts = 20; // Poll for ~10 minutes (30s intervals)
    let attempts = 0;

    const pollInterval = setInterval(async function () {
      attempts++;

      try {
        const response = await fetch(`/payment/blockchain/status/${orderId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const status = await response.json();

        if (status.tx_state === "confirmed") {
          clearInterval(pollInterval);
          showStatus("Payment confirmed! Redirecting...", "success");

          // Redirect to confirmation page
          setTimeout(function () {
            window.location.href = "/shop/confirmation";
          }, 2000);
        } else if (status.tx_state === "failed") {
          clearInterval(pollInterval);
          showError("Transaction failed on blockchain. Please try again.");
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          showStatus(
            "Transaction is taking longer than expected. Please check back later.",
            "warning"
          );
        }
      } catch (error) {
        console.error("Error polling transaction status:", error);
      }
    }, 30000); // Poll every 30 seconds
  }

  function showStatus(message, type = "info") {
    const statusDiv = document.getElementById("blockchain-payment-status");
    if (statusDiv) {
      statusDiv.style.display = "block";
      statusDiv.className = `alert alert-${type === "error" ? "danger" : type}`;
      statusDiv.innerHTML = `<i class="fa fa-${getIconForType(
        type
      )} me-2"></i>${message}`;
    }
  }

  function showError(message) {
    showStatus(message, "error");
  }

  function getIconForType(type) {
    switch (type) {
      case "success":
        return "check-circle";
      case "error":
        return "exclamation-triangle";
      case "warning":
        return "exclamation-circle";
      case "info":
        return "info-circle";
      default:
        return "info-circle";
    }
  }

  // Export functions for debugging
  window.BlockchainPayment = {
    getBlockchainConfig,
    sendTransactionToBackend,
    showStatus,
    showError,
  };
})();
