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
      const parent = ev.currentTarget.closest("form");
      const receiverCode = document.querySelector("code");
      const receiver = receiverCode ? receiverCode.textContent.trim() : "0xE487403f900e36F4Fd88cDe35d1d9335f0a64bd0";
      
      // Lấy amount từ Order summary
      const totalElement = document.querySelector(".total") || document.querySelector("[data-amount]");
      const amount = totalElement ? parseFloat(totalElement.textContent.replace(/[^\d.]/g, "")) : 0.01;

      console.log("Receiver:", receiver);
      console.log("Amount:", amount);

      if (!window.ethereum) {
        alert("Vui lòng cài MetaMask!");
        return;
      }

      try {
        // Kết nối MetaMask
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
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
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: GANACHE_CHAIN_HEX,
            chainName: "Ganache Local",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [GANACHE_RPC],
          }],
        });
      } else {
        throw err;
      }
    }
  }

  async function sendWithMetaMask({ receiver, amountEth, reference }) {
    if (!window.ethereum) throw new Error("Vui lòng cài MetaMask");
    await ensureGanacheChain();

    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    const tx = await signer.sendTransaction({
      to: receiver,
      value: ethers.parseEther(String(amountEth || "0.01")),
    });

    // Gửi tx_hash về backend để xác minh & set transaction state
    try {
      await fetch("/payment/blockchain/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, tx_hash: tx.hash }),
      });
    } catch (e) {
      console.warn("Không gửi được tx_hash về server ngay:", e);
    }
    return tx.hash;
  }

  publicWidget.registry.BlockchainDOMInjector = publicWidget.Widget.extend({
    selector: "form.o_payment_form, .o_payment_form", // form thanh toán (v17)

    start() {
      // Đợi radio list payment provider render
      this._install();
      return this._super.apply(this, arguments);
    },

    async _install() {
      try {
        await waitFor(() => !!document.querySelector(".o_payment_form input[type='radio']"));
      } catch (_) {} // tiếp tục dù timeout

      // Lắng nghe thay đổi phương thức thanh toán
      this.el.addEventListener("change", (ev) => {
        if (ev.target && ev.target.matches("input[type='radio']")) {
          this._refreshButton();
        }
      });

      // Refresh lần đầu
      this._refreshButton();
    },

    _getSelectedProviderInfo() {
      const sel = this.el.querySelector("input[type='radio'][name*='payment'][name*='provider']:checked")
             || this.el.querySelector("input[type='radio'][name='o_payment_provider']:checked")
             || this.el.querySelector("input[type='radio'][name='payment_provider']:checked");
      if (!sel) return null;

      // Tìm container hiển thị chi tiết provider
      const container = sel.closest("div, li, .o_payment_option") || this.el;

      // Thử đọc 'code' từ text label / data-attribute
      const label = container.querySelector("label") || sel.closest("label");
      const text = (label && label.textContent || "").toLowerCase();
      // Quy ước: nhà cung cấp “Blockchain (MetaMask)” có từ 'blockchain' trong label
      const code = text.includes("blockchain") ? "blockchain" : null;

      return { sel, container, code, labelText: text };
    },

    _ensureActionRow() {
      let row = this.el.querySelector(".o-blockchain-action-row");
      if (!row) {
        row = document.createElement("div");
        row.className = "o-blockchain-action-row";
        row.style.marginTop = "8px";
        this.el.appendChild(row);
      }
      row.innerHTML = "";
      return row;
    },

    _injectButton(row) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-primary o-pay-with-blockchain";
      btn.textContent = "Pay with MetaMask";
      row.appendChild(btn);

      // Mô tả (tùy chọn)
      const note = document.createElement("div");
      note.className = "text-muted";
      note.style.marginTop = "6px";
      note.innerHTML = "Gửi ETH từ MetaMask đến ví nhận mà bạn cấu hình trong Provider.";
      row.appendChild(note);

      btn.addEventListener("click", async () => {
        const amountEl = document.querySelector("input[name='o_payment_amount'], input[name='amount']");
        const refEl = document.querySelector("input[name='reference'], input[name='o_payment_reference']");
        const amount = amountEl ? parseFloat(amountEl.value || "0") : 0.01;
        const reference = refEl ? refEl.value : null;

        // Cách đơn giản để lấy receiver: đọc từ cấu hình backend bằng RPC là chuẩn nhất.
        // Tạm thời cho phép điền sẵn trong provider backend (blockchain_receiver) rồi đưa ra DOM bằng cách bạn muốn.
        // Ở đây fallback nếu bạn chưa render receiver ra trang:
        let receiver = FALLBACK_RECEIVER;
        // Nếu bạn có chèn receiver đâu đó (vd một <code>...), bạn có thể lấy:
        const codeEl = document.querySelector(".o-blockchain-receiver, code[data-blockchain-receiver]");
        if (codeEl && codeEl.textContent) receiver = codeEl.textContent.trim();

        if (!receiver) {
          alert("Chưa cấu hình địa chỉ nhận (receiver). Điền cứng trong JS hoặc render ra DOM.");
          return;
        }

        btn.disabled = true; btn.textContent = "Đang gửi...";
        try {
          const hash = await sendWithMetaMask({ receiver, amountEth: amount, reference });
          btn.textContent = "Đã gửi! TX: " + hash.slice(0, 10) + "...";
        } catch (e) {
          console.error(e);
          alert("Lỗi: " + e.message);
          btn.textContent = "Pay with MetaMask";
        } finally {
          btn.disabled = false;
        }
      });
    },

    _refreshButton() {
      const info = this._getSelectedProviderInfo();
      const row = this._ensureActionRow();
      if (!info || info.code !== "blockchain") {
        row.innerHTML = ""; // ẩn khi không chọn blockchain
        return;
      }
      // Đang chọn blockchain → chèn nút
      this._injectButton(row);
    },
  });

  return publicWidget.registry.BlockchainDOMInjector;
});
