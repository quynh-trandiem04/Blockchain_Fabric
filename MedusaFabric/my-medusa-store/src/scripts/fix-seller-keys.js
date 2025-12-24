// // src/scripts/fix-seller-keys.js

// const { Modules } = require("@medusajs/utils");
// const crypto = require('crypto');
// // const enrollSellerIdentity = require("./enroll-helper"); // <-- COMMENT DÒNG NÀY

// async function fixSellerKeys(container) {
//     const marketplaceService = container.resolve("marketplace");
//     const userModuleService = container.resolve(Modules.USER);

//     console.log("🛠️  Starting Fix Seller RSA Keys (Skip Wallet)...");

//     const sellers = await marketplaceService.listSellers({ status: "approved" });

//     for (const seller of sellers) {
//         let hasKey = !!seller.metadata?.rsa_public_key;
//         console.log(`Checking Seller: ${seller.company_code} (${seller.name}) - Has Key: ${hasKey}`);

//         if (!hasKey) {
//             console.log(`🔑 Generating RSA keys for ${seller.company_code}...`);
            
//             const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
//                 modulusLength: 2048,
//                 publicKeyEncoding: { type: 'spki', format: 'pem' },
//                 privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
//             });

//             // Update Seller
//             await marketplaceService.updateSellers([{
//                 id: seller.id,
//                 metadata: { ...seller.metadata, rsa_public_key: publicKey }
//             }]);

//             // Update User
//             if (seller.admin_user_id) {
//                 const user = await userModuleService.retrieveUser(seller.admin_user_id);
//                 await userModuleService.updateUsers([{
//                     id: seller.admin_user_id,
//                     metadata: { ...(user.metadata || {}), rsa_private_key: privateKey }
//                 }]);
//                 console.log(`   -> Updated User Private Key`);
//             }

//             // --- COMMENT ĐOẠN TẠO VÍ DƯỚI ĐÂY ---
//             // Vì ta đang dùng "seller_admin" chung cho mọi giao dịch Blockchain để ổn định
//             /*
//             try {
//                 console.log(`⚡ Enrolling wallet for ${seller.company_code}...`);
//                 await enrollSellerIdentity(seller.company_code, seller.company_code);
//                 console.log(`   ✅ Wallet Created.`);
//             } catch (e) {
//                 console.warn(`   ⚠️ Wallet Enroll Warning: ${e.message}`);
//             }
//             */
//         }
//     }
//     console.log("🎉 Fix Complete!");
// }

// module.exports = fixSellerKeys;