// Simple ethers mock for demo - just the basic functions we need
window.ethers = {
  BrowserProvider: function (ethereum) {
    this.ethereum = ethereum;
    this.getSigner = async function () {
      return {
        sendTransaction: async function (tx) {
          // Use web3 directly via MetaMask
          const accounts = await ethereum.request({
            method: "eth_requestAccounts",
          });
          const txHash = await ethereum.request({
            method: "eth_sendTransaction",
            params: [
              {
                from: accounts[0],
                to: tx.to,
                value: tx.value,
              },
            ],
          });
          return { hash: txHash };
        },
      };
    };
  },
  parseEther: function (value) {
    // Convert ETH to Wei (multiply by 10^18)
    const wei = (parseFloat(value) * Math.pow(10, 18)).toString(16);
    return "0x" + wei;
  },
};
