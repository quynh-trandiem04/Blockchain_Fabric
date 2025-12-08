// my-medusa-store/src/modules/marketplace/service.ts

import { MedusaService } from "@medusajs/framework/utils"
import { Seller } from "./models/seller"
import { Carrier } from "./models/carrier"

class MarketplaceService extends MedusaService({
  Seller,
  Carrier,
}) {}

export default MarketplaceService