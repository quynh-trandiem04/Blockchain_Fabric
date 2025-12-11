// my-medusa-store\src\modules\simple-payment\index.ts

import { 
  AbstractPaymentProvider, 
  PaymentSessionStatus 
} from "@medusajs/framework/utils"
import { Logger, WebhookActionResult } from "@medusajs/types"

// --- PROVIDER 1: MANUAL (Prepaid) ---
class ManualProvider extends AbstractPaymentProvider<any> {
  static identifier = "pp_system_default"
  constructor(container: any, options: any) { super(container, options) }
  static validateOptions(options: any) { }

  async initiatePayment(input: any) {
    return {
      id: "manual_sess_" + Date.now(),
      data: { 
        status: "pending", 
        amount: input.amount 
      }
    }
  }

  async authorizePayment(input: any) {
    return { 
      status: PaymentSessionStatus.AUTHORIZED, 
      data: { ...input, status: "authorized" } 
    }
  }

  // [FIX] Merge input vào kết quả trả về để thỏa mãn TypeScript
  async cancelPayment(input: any) { 
    return { ...input, status: "canceled" } 
  }

  // [FIX] Merge input vào kết quả trả về
  async capturePayment(input: any) { 
    return { ...input, status: "captured" } 
  }

  async deletePayment(input: any) { return {} }

  async getPaymentStatus(input: any) { 
    return { status: PaymentSessionStatus.AUTHORIZED } 
  }

  // [FIX] Refund nhận input chứa amount, trả về data đã update
  async refundPayment(input: any) { 
    return { ...input, refunded_amount: input.amount } 
  }

  async retrievePayment(input: any) { return input }

  async updatePayment(input: any) { 
    return { data: { ...input, amount: input.amount } } 
  }

  async getWebhookActionAndData(data: any): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

// --- PROVIDER 2: SHIP COD ---
class CodProvider extends AbstractPaymentProvider<any> {
  static identifier = "pp_cod"
  constructor(container: any, options: any) { super(container, options) }
  static validateOptions(options: any) { }

  async initiatePayment(input: any) {
    return {
      id: "cod_sess_" + Date.now(),
      data: { 
        status: "pending", 
        amount: input.amount, 
        is_cod: true 
      }
    }
  }

  async authorizePayment(input: any) {
    return { 
      status: PaymentSessionStatus.AUTHORIZED, 
      data: { ...input, status: "authorized" } 
    }
  }

  // [FIX] Merge input
  async cancelPayment(input: any) { 
    return { ...input, status: "canceled" } 
  }

  // [FIX] Merge input
  async capturePayment(input: any) { 
    return { ...input, status: "captured" } 
  }

  async deletePayment(input: any) { return {} }

  async getPaymentStatus(input: any) { 
    return { status: PaymentSessionStatus.AUTHORIZED } 
  }

  // [FIX] Refund logic
  async refundPayment(input: any) { 
    return { ...input, refunded_amount: input.amount } 
  }

  async retrievePayment(input: any) { return input }

  async updatePayment(input: any) { 
    return { 
      data: { ...input, amount: input.amount, is_cod: true } 
    } 
  }

  async getWebhookActionAndData(data: any): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

// EXPORT CẢ 2
export const services = [ManualProvider, CodProvider]