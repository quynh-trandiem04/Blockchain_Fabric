// src/loaders/blockchain-event-listener.ts
import { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/utils";
import reduceInventoryOnDeliveredHandler from '../subscribers/reduce-inventory-on-delivered.js';

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const CCP_PATH = path.resolve(process.cwd(), 'connection-profile.yaml');
const CHANNEL_NAME = 'orderchannel';
const CC_NAME = 'my-ecommerce-chaincode';

/**
 * Blockchain Event Listener
 * Lắng nghe events từ Hyperledger Fabric chaincode
 * Khi blockchain emit event status thay đổi → Tự động trigger Medusa subscriber để trừ kho
 */
export default async (container: MedusaContainer) => {
    console.log('[Blockchain Listener] Initializing...');

    // Delay để đảm bảo container đã load đầy đủ
    setTimeout(async () => {
        try {
            // Load connection profile
            if (!fs.existsSync(CCP_PATH)) {
                console.warn('[Blockchain Listener] Connection profile not found. Skipping event listener.');
                return;
            }

            const yamlDocs = yaml.loadAll(fs.readFileSync(CCP_PATH, 'utf8'));
            const ccp = yamlDocs[0];

            // Load wallet
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = await Wallets.newFileSystemWallet(walletPath);

            // Sử dụng admin identity để listen events
            const identity = await wallet.get('admin');
            if (!identity) {
                console.warn('[Blockchain Listener] Admin identity not found. Skipping event listener.');
                return;
            }

            // Connect to gateway
            const gateway = new Gateway();
            await gateway.connect(ccp, {
                wallet,
                identity: 'admin',
                discovery: { enabled: false, asLocalhost: false }
            });

            const network = await gateway.getNetwork(CHANNEL_NAME);
            const contract = network.getContract(CC_NAME);

            console.log('[Blockchain Listener] Connected to blockchain network');

            // Listen to ALL chaincode events
            const listener = async (event: any) => {
                try {
                    const eventName = event.eventName;
                    const payload = event.payload?.toString('utf8');

                    console.log(`\n[Blockchain Event] Received: ${eventName}`);
                    console.log(`   Raw Payload:`, payload);

                    if (!payload) {
                        console.log(`   Empty payload - skipping`);
                        return;
                    }

                    const eventData = JSON.parse(payload);
                    console.log(`   Parsed Data:`, JSON.stringify(eventData, null, 2));

                    // Xử lý event thay đổi status đơn hàng
                    // Chaincode có thể emit các event names khác nhau:
                    // - OrderStatusChanged
                    // - OrderShipped
                    // - StatusUpdate
                    // v.v...

                    const orderId = eventData.orderId || eventData.OrderID || eventData.order_id;
                    const newStatus = eventData.newStatus || eventData.Status || eventData.status || eventData.NewStatus;

                    console.log(`   Extracted orderId: ${orderId}`);
                    console.log(`   Extracted newStatus: ${newStatus}`);

                    if (orderId && newStatus) {
                        console.log(`   Order: ${orderId} → Status: ${newStatus}`);

                        // Chỉ xử lý khi status = SHIPPED
                        const statusUpper = newStatus.toUpperCase();
                        console.log(`   Status check: '${statusUpper}' === 'SHIPPED' ? ${statusUpper === 'SHIPPED'}`);

                        if (statusUpper === 'SHIPPED') {
                            console.log(`   Status matched! Triggering inventory reduction...`);

                            try {
                                await reduceInventoryOnDeliveredHandler({
                                    event: {
                                        name: 'blockchain.order.status.changed',
                                        data: {
                                            orderId: orderId,
                                            order_id: orderId,
                                            newStatus: newStatus,
                                            status: newStatus
                                        }
                                    },
                                    container: container,
                                    pluginOptions: {}
                                });

                                console.log(`   Inventory reduction completed for order ${orderId}`);
                            } catch (reduceError: any) {
                                console.error(`   Inventory reduction failed:`, reduceError.message);
                                console.error(`   Stack:`, reduceError.stack);
                            }
                        } else {
                            console.log(`   Skipping - Status '${newStatus}' is not SHIPPED`);
                        }
                    } else {
                        console.log(`   Missing orderId or newStatus - orderId: ${orderId}, status: ${newStatus}`);
                    }

                } catch (error: any) {
                    console.error('[Blockchain Listener] Event processing error:', error.message);
                }
            };

            // Register event listener
            await contract.addContractListener(listener);

            console.log('[Blockchain Listener] Active and listening for events');
            console.log('Monitoring blockchain for order status changes...');

            // Giữ connection alive
            process.on('SIGINT', async () => {
                console.log('\n[Blockchain Listener] Disconnecting...');
                gateway.disconnect();
                process.exit(0);
            });

        } catch (error: any) {
            console.error('[Blockchain Listener] Setup failed:', error.message);
            console.warn('Continuing without blockchain event listener');
        }
    }, 3000); // Delay 3s để đảm bảo container đã sẵn sàng
};
