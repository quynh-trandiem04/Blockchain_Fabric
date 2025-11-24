// src/loaders/register-fabric.ts
import { MedusaContainer } from "@medusajs/framework/types";
// Import Class FabricService (Lưu ý đường dẫn tương đối)
const FabricService = require("../services/fabric");

export default async (container: MedusaContainer) => {
  container.register({
    fabricService: {
      resolve: (c) => new FabricService(c),
    },
  });
};