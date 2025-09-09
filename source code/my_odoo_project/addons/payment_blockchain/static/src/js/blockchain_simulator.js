/**
 * Blockchain Simulator Frontend
 * Mô phỏng cơ chế hoạt động của Blockchain
 */

class BlockchainSimulator {
  constructor() {
    this.blockchainData = [];
    this.isLoading = false;
    this.init();
  }

  async init() {
    console.log("🔗 Initializing Blockchain Simulator...");
    await this.loadBlockchainStatus();
    this.bindEvents();
    this.renderBlockchain();
  }

  bindEvents() {
    document
      .getElementById("btn-add-block")
      .addEventListener("click", () => this.addBlock());
    document
      .getElementById("btn-add-transaction")
      .addEventListener("click", () => this.addTransactionBlock());
    document
      .getElementById("btn-tamper")
      .addEventListener("click", () => this.simulateTamper());
    document
      .getElementById("btn-reset")
      .addEventListener("click", () => this.resetBlockchain());
  }

  async loadBlockchainStatus() {
    try {
      this.showLoading(true);
      const response = await fetch("/blockchain/simulator/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      this.blockchainData = data.blockchain_data || [];
      this.updateStatusDisplay(data);
      this.renderBlockchain();
    } catch (error) {
      console.error("Error loading blockchain status:", error);
      this.showError("Không thể tải trạng thái blockchain");
    } finally {
      this.showLoading(false);
    }
  }

  async addBlock() {
    if (this.isLoading) return;

    try {
      this.showMining(true);
      this.isLoading = true;

      // Simulate mining delay for educational purposes
      await this.simulateMining();

      const response = await fetch("/blockchain/simulator/add_block", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_data: [
            {
              type: "demo_block",
              message: "Demo block được tạo từ simulator",
              timestamp: new Date().toISOString(),
              amount: Math.floor(Math.random() * 1000) + 100,
            },
          ],
        }),
      });

      const result = await response.json();
      if (result.success) {
        this.showSuccess(
          `✅ Block #${result.block_number} đã được thêm thành công!`
        );
        await this.loadBlockchainStatus();
      } else {
        this.showError("Không thể thêm block mới");
      }
    } catch (error) {
      console.error("Error adding block:", error);
      this.showError("Lỗi khi thêm block: " + error.message);
    } finally {
      this.showMining(false);
      this.isLoading = false;
    }
  }

  async addTransactionBlock() {
    if (this.isLoading) return;

    const amount = prompt("Nhập số tiền giao dịch (VND):", "50000");
    const recipient = prompt(
      "Nhập địa chỉ người nhận:",
      "0x742d35Cc6C0532" + Math.random().toString(16).substr(2, 8)
    );

    if (!amount || !recipient) return;

    try {
      this.showMining(true);
      this.isLoading = true;

      await this.simulateMining();

      const response = await fetch("/blockchain/simulator/add_block", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_data: [
            {
              type: "payment_transaction",
              amount: parseFloat(amount),
              recipient: recipient,
              sender: "0x1234567890abcdef",
              message: `Chuyển ${amount} VND đến ${recipient}`,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      const result = await response.json();
      if (result.success) {
        this.showSuccess(
          `💰 Giao dịch ${amount} VND đã được ghi vào Block #${result.block_number}!`
        );
        await this.loadBlockchainStatus();
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
      this.showError("Lỗi khi thêm giao dịch: " + error.message);
    } finally {
      this.showMining(false);
      this.isLoading = false;
    }
  }

  async simulateTamper() {
    if (this.blockchainData.length <= 1) {
      this.showError("Cần ít nhất 2 block để mô phỏng tấn công");
      return;
    }

    const blockNumber = prompt(
      `Nhập số block muốn tấn công (1-${this.blockchainData.length - 1}):`,
      "1"
    );
    if (!blockNumber) return;

    try {
      this.showLoading(true);
      const response = await fetch("/blockchain/simulator/tamper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          block_number: parseInt(blockNumber),
        }),
      });

      const result = await response.json();
      if (result.chain_broken) {
        this.showWarning(
          `⚠️ Blockchain đã bị phá vỡ! Block #${result.tampered_block} và các block sau đã không hợp lệ. Điều này chứng minh tính bất biến của blockchain.`
        );
      }
      await this.loadBlockchainStatus();
    } catch (error) {
      console.error("Error simulating tamper:", error);
      this.showError("Lỗi khi mô phỏng tấn công: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async resetBlockchain() {
    if (
      !confirm("Bạn có chắc chắn muốn reset blockchain về trạng thái ban đầu?")
    )
      return;

    try {
      this.showLoading(true);
      const response = await fetch("/blockchain/simulator/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      if (result.success) {
        this.showSuccess("🔄 Blockchain đã được reset về Genesis Block");
        await this.loadBlockchainStatus();
      }
    } catch (error) {
      console.error("Error resetting blockchain:", error);
      this.showError("Lỗi khi reset blockchain: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async simulateMining() {
    const miningSection = document.getElementById("mining-section");
    const progressBar = document.getElementById("mining-progress");

    miningSection.style.display = "block";

    // Simulate mining progress
    for (let i = 0; i <= 100; i += 10) {
      progressBar.style.width = i + "%";
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  renderBlockchain() {
    const container = document.getElementById("blockchain-container");
    if (!container) return;

    container.innerHTML = "";
    container.className = "blockchain-container";

    this.blockchainData.forEach((block, index) => {
      const blockElement = this.createBlockElement(block, index);
      container.appendChild(blockElement);

      // Add arrow between blocks
      if (index < this.blockchainData.length - 1) {
        const arrow = document.createElement("div");
        arrow.className = "block-arrow";
        arrow.innerHTML = "→";
        blockElement.appendChild(arrow);
      }
    });
  }

  createBlockElement(block, index) {
    const blockDiv = document.createElement("div");
    blockDiv.className = `block-item ${
      block.block_number === 0 ? "genesis" : ""
    } ${!block.is_valid ? "invalid" : ""}`;

    const statusBadge = block.is_valid
      ? '<span class="badge bg-success status-badge">Valid</span>'
      : '<span class="badge bg-danger status-badge">Invalid</span>';

    const transactionsList = block.transactions
      .map(
        (tx) =>
          `<li class="small">${tx.type}: ${
            tx.message || tx.amount || "N/A"
          }</li>`
      )
      .join("");

    blockDiv.innerHTML = `
            ${statusBadge}
            <h6 class="text-primary mb-3">
                <i class="fa fa-cube me-2"></i>
                Block #${block.block_number}
                ${block.block_number === 0 ? "(Genesis)" : ""}
            </h6>
            
            <div class="mb-2">
                <strong>Hash:</strong>
                <div class="hash-display">${block.hash}</div>
            </div>
            
            ${
              block.block_number > 0
                ? `
                <div class="mb-2">
                    <strong>Previous Hash:</strong>
                    <div class="hash-display">${block.previous_hash}</div>
                </div>
            `
                : ""
            }
            
            <div class="mb-2">
                <strong>Timestamp:</strong> ${block.timestamp}
            </div>
            
            ${
              block.nonce !== undefined
                ? `
                <div class="mb-2">
                    <strong>Nonce:</strong> ${block.nonce}
                </div>
            `
                : ""
            }
            
            <div class="mb-2">
                <strong>Transactions:</strong>
                <ul class="mt-1 mb-0">${transactionsList}</ul>
            </div>
        `;

    return blockDiv;
  }

  updateStatusDisplay(data) {
    const statusContent = document.getElementById("status-content");
    const statusCard = document.getElementById("status-card");

    if (data.is_chain_valid) {
      statusCard.className = "card border-success";
      statusCard.querySelector(".card-header").className =
        "card-header bg-success text-white";
    } else {
      statusCard.className = "card border-danger";
      statusCard.querySelector(".card-header").className =
        "card-header bg-danger text-white";
    }

    statusContent.innerHTML = `
            <div class="row">
                <div class="col-md-3">
                    <h6><i class="fa fa-cubes me-2"></i>Tổng số Block</h6>
                    <h4 class="text-primary">${data.total_blocks}</h4>
                </div>
                <div class="col-md-3">
                    <h6><i class="fa fa-shield me-2"></i>Trạng thái chuỗi</h6>
                    <h4 class="${
                      data.is_chain_valid ? "text-success" : "text-danger"
                    }">
                        ${data.is_chain_valid ? "✅ Hợp lệ" : "❌ Không hợp lệ"}
                    </h4>
                </div>
                <div class="col-md-3">
                    <h6><i class="fa fa-exclamation-triangle me-2"></i>Block lỗi</h6>
                    <h4 class="text-warning">${data.invalid_blocks.length}</h4>
                </div>
                <div class="col-md-3">
                    <h6><i class="fa fa-hashtag me-2"></i>Latest Hash</h6>
                    <small class="hash-display">${
                      data.latest_block
                        ? data.latest_block.substring(0, 16) + "..."
                        : "N/A"
                    }</small>
                </div>
            </div>
            ${
              !data.is_chain_valid
                ? `
                <div class="alert alert-danger mt-3">
                    <strong>⚠️ Cảnh báo:</strong> Blockchain đã bị phá vỡ tại các block: ${data.invalid_blocks.join(
                      ", "
                    )}
                    <br><small>Điều này chứng minh tính bất biến của blockchain - khi dữ liệu bị thay đổi, toàn bộ chuỗi sẽ bị phá vỡ.</small>
                </div>
            `
                : ""
            }
        `;
  }

  showLoading(show) {
    const buttons = document.querySelectorAll(
      "#btn-add-block, #btn-add-transaction, #btn-tamper, #btn-reset"
    );
    buttons.forEach((btn) => {
      btn.disabled = show;
      if (show) {
        btn.innerHTML = btn.innerHTML.replace(
          /(<i[^>]*><\/i>\s*)/,
          '$1<i class="fa fa-spinner fa-spin me-2"></i>'
        );
      } else {
        btn.innerHTML = btn.innerHTML.replace(
          /<i class="fa fa-spinner fa-spin me-2"><\/i>/g,
          ""
        );
      }
    });
  }

  showMining(show) {
    const miningSection = document.getElementById("mining-section");
    if (show) {
      miningSection.style.display = "block";
    } else {
      miningSection.style.display = "none";
    }
  }

  showSuccess(message) {
    this.showAlert(message, "success");
  }

  showError(message) {
    this.showAlert(message, "danger");
  }

  showWarning(message) {
    this.showAlert(message, "warning");
  }

  showAlert(message, type) {
    // Remove existing alerts
    document
      .querySelectorAll(".blockchain-alert")
      .forEach((alert) => alert.remove());

    const alert = document.createElement("div");
    alert.className = `alert alert-${type} alert-dismissible fade show blockchain-alert`;
    alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

    document
      .querySelector(".container")
      .insertBefore(alert, document.querySelector(".container").firstChild);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("blockchain-container")) {
    new BlockchainSimulator();
  }
});

// Export for global access
window.BlockchainSimulator = BlockchainSimulator;
