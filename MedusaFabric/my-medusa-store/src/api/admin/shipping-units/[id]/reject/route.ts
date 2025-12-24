// my-medusa-store\src\api\admin\shipping-units\[id]\reject

import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { Modules } from "@medusajs/utils";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params; 
  const container = req.scope;
  
  const userModuleService = container.resolve(Modules.USER);
  const marketplaceService = container.resolve("marketplace") as any;

  try {
    console.log(`Rejecting Shipper User ID: ${id}...`);

    const user = await userModuleService.retrieveUser(id).catch(() => null);
    
    if (!user) {
        return res.status(404).json({ error: "Shipper User not found" });
    }

    const companyCode = user.metadata?.company_code;

    // XÓA Carrier Profile nếu có
    if (companyCode) {
        const carriers = await marketplaceService.listCarriers({ code: companyCode });
        if (carriers.length > 0) {
            const carrierIds = carriers.map((c: any) => c.id);
            await marketplaceService.deleteCarriers(carrierIds);
            console.log(`   -> Deleted Carrier Profile(s): ${carrierIds.join(", ")}`);
        }
    }

    // XÓA User
    await userModuleService.deleteUsers([id]);
    console.log(`   -> Deleted Medusa User`);

    res.json({ message: "Đã từ chối và xóa dữ liệu thành công." });

  } catch (error: any) {
    console.error("Reject Error:", error);
    res.status(500).json({ error: error.message });
  }
};