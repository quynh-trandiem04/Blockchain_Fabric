/** Minimal demo: gọi MetaMask gửi ETH tới ví receiver đã cấu hình */
odoo.define("payment_blockchain.blockchain_provider", function (require) {
  "use strict";
  const publicWidget = require("web.public.widget");

  publicWidget.registry.BlockchainPay = publicWidget.Widget.extend({
    selector: ".o-pay-with-blockchain",
    events: { click: "_onClick" },

    async _onClick(ev) {
      ev.preventDefault();
      console.log("Blockchain payment button clicked!");

      // Tìm thông tin từ DOM
      const receiverCode = document.querySelector("code");
      const receiver = receiverCode
        ? receiverCode.textContent.trim()
        : "0xE487403f900e36F4Fd88cDe35d1d9335f0a64bd0";

      // Lấy amount từ Order summary
      const totalElement =
        document.querySelector(".total") ||
        document.querySelector("[data-amount]");
      const amount = totalElement
        ? parseFloat(totalElement.textContent.replace(/[^\d.]/g, ""))
        : 0.01;

      console.log("Receiver:", receiver);
      console.log("Amount:", amount);

      if (!window.ethereum) {
        alert("Vui lòng cài MetaMask!");
        return;
      }

      try {
        // Kết nối MetaMask
        await window.ethereum.request({ method: "eth_requestAccounts" });

        // Kiểm tra ethers
        if (typeof ethers === "undefined") {
          alert("Ethers.js chưa được load. Vui lòng thêm ethers script!");
          return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Convert amount to ETH (giả định 1 USD = 0.001 ETH)
        const ethToSend = (amount * 0.001).toString();

        const tx = await signer.sendTransaction({
          to: receiver,
          value: ethers.parseEther(ethToSend),
        });

        alert(`Giao dịch thành công! TX hash: ${tx.hash}`);
        console.log("Transaction:", tx);

        // TODO: Gửi tx.hash về server để xác minh
      } catch (e) {
        console.error("Error:", e);
        alert(`Giao dịch lỗi: ${e.message}`);
      }
    },
  });

  return publicWidget.registry.BlockchainPay;
});
