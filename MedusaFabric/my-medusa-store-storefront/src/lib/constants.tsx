// my-medusa-store-storefront\src\lib\constants.tsx

import React from "react"
import { CreditCard, Cash } from "@medusajs/icons"

import Ideal from "@modules/common/icons/ideal"
import Bancontact from "@modules/common/icons/bancontact"
import PayPal from "@modules/common/icons/paypal"

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_stripe_stripe: {
    title: "Credit card",
    icon: <CreditCard />,
  },
  "pp_medusa-payments_default": {
    title: "Credit card",
    icon: <CreditCard />,
  },
  "pp_stripe-ideal_stripe": {
    title: "iDeal",
    icon: <Ideal />,
  },
  "pp_stripe-bancontact_stripe": {
    title: "Bancontact",
    icon: <Bancontact />,
  },
  pp_paypal_paypal: {
    title: "PayPal",
    icon: <PayPal />,
  },
  pp_system_default: {
    title: "Manual Payment",
    icon: <CreditCard />,
  },
  // [3] CẤU HÌNH SHIP COD (ID MỚI)
  // Lưu ý: Trong Admin Medusa, bạn cần đảm bảo Provider này có ID là 'manual'
  pp_cod: {
    title: "Ship COD (Cash on Delivery)",
    icon: <Cash />,
  },
  // Fallback cho manual nếu cần
  manual: {
    title: "Ship COD",
    icon: <Cash />,
  }
}

export const isStripeLike = (providerId?: string) => {
  return providerId?.startsWith("pp_stripe_") || providerId?.startsWith("pp_medusa-")
}

export const isPaypal = (providerId?: string) => {
  return providerId?.startsWith("pp_paypal")
}
export const isManual = (providerId?: string) => {
  return (
    providerId?.startsWith("pp_system_default") || 
    providerId?.startsWith("pp_cod")
  )
}

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
]
