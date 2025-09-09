// Blockchain payment provider - prevent conflicts with Odoo payment flow
(function () {
  "use strict";

  console.log("Blockchain payment provider loaded");

  // Override payment form behavior for blockchain
  document.addEventListener("DOMContentLoaded", function () {
    overridePaymentFlow();
  });

  function overridePaymentFlow() {
    // Find blockchain payment radio and override its behavior
    const blockchainRadios = document.querySelectorAll(
      'input[name="o_payment_radio"]'
    );

    blockchainRadios.forEach(function (radio) {
      if (radio.value && radio.value.includes("blockchain")) {
        console.log("Found blockchain payment radio:", radio.value);

        // Override form submission when blockchain is selected
        const form = radio.closest("form");
        if (form) {
          const originalSubmit = form.onsubmit;

          form.onsubmit = function (e) {
            const selectedRadio = form.querySelector(
              'input[name="o_payment_radio"]:checked'
            );

            if (selectedRadio && selectedRadio.value.includes("blockchain")) {
              console.log(
                "Blockchain payment selected - preventing default form submission"
              );
              e.preventDefault();
              e.stopPropagation();

              // Trigger blockchain payment instead
              handleBlockchainPaymentFromForm(form);
              return false;
            }

            // Allow normal flow for other payment methods
            if (originalSubmit) {
              return originalSubmit.call(this, e);
            }
            return true;
          };
        }

        // Also override submit button clicks
        const submitButton = form.querySelector(
          'button[type="submit"], input[type="submit"]'
        );
        if (submitButton) {
          submitButton.addEventListener("click", function (e) {
            const selectedRadio = form.querySelector(
              'input[name="o_payment_radio"]:checked'
            );

            if (selectedRadio && selectedRadio.value.includes("blockchain")) {
              console.log("Submit button clicked for blockchain payment");
              e.preventDefault();
              e.stopPropagation();
              handleBlockchainPaymentFromForm(form);
            }
          });
        }
      }
    });
  }

  async function handleBlockchainPaymentFromForm(form) {
    try {
      console.log("Processing blockchain payment from form");

      if (!window.ethereum) {
        alert("Please install MetaMask to proceed with blockchain payment!");
        return;
      }

      // Get receiver address from blockchain info
      const receiverElement = document.querySelector(
        ".blockchain-info code, code"
      );
      const receiver = receiverElement
        ? receiverElement.textContent.trim()
        : "0xE487403f900e36F4Fd88cDe35d1d9335f0a64bd0";

      console.log("Receiver address:", receiver);

      // Request MetaMask connection
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      console.log("MetaMask connected:", accounts[0]);

      // Send blockchain transaction
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

      console.log("Blockchain transaction successful:", txHash);
      alert(`Blockchain payment successful!\nTransaction hash: ${txHash}`);

      // Get reference from form
      const referenceInput = form.querySelector('input[name="reference"]');
      const reference = referenceInput ? referenceInput.value : null;

      if (reference) {
        // Send transaction details to backend
        console.log("Sending transaction to backend...");

        const response = await fetch("/payment/blockchain/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
              provider_code: "blockchain",
              reference: reference,
              blockchain_tx_hash: txHash,
            },
          }),
        });

        const result = await response.json();
        console.log("Backend response:", result);

        // Redirect to payment status
        if (result.result && result.result.redirect_url) {
          window.location.href = result.result.redirect_url;
        } else {
          window.location.href = "/payment/status";
        }
      } else {
        console.log("No reference found, redirecting to status page");
        window.location.href = "/payment/status";
      }
    } catch (error) {
      console.error("Blockchain payment failed:", error);
      alert("Blockchain payment failed: " + error.message);
    }
  }

  // Reinitialize when DOM changes (for dynamic content)
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length > 0) {
        setTimeout(overridePaymentFlow, 500);
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
