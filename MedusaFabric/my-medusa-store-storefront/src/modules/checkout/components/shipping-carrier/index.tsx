// my-medusa-store-storefront/src/modules/checkout/components/shipping-carrier/index.tsx

import { RadioGroup } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import { CheckCircleSolid } from "@medusajs/icons"

type ShippingCarrierProps = {
  selectedCarrier: string
  setCarrier: (value: string) => void
}

const carriers = [
  { id: "GHN", name: "Giao Hàng Nhanh", price: "Standard" },
  { id: "VTP", name: "Viettel Post", price: "Express" },
]

const ShippingCarrier = ({ selectedCarrier, setCarrier }: ShippingCarrierProps) => {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 mt-4">
      <h2 className="text-xl font-semibold mb-4">Đơn vị vận chuyển</h2>
      <RadioGroup value={selectedCarrier} onChange={setCarrier}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {carriers.map((carrier) => (
            <RadioGroup.Option
              key={carrier.id}
              value={carrier.id}
              className={({ checked }) =>
                clx(
                  "relative flex cursor-pointer rounded-lg px-5 py-4 shadow-md focus:outline-none",
                  checked ? "bg-sky-900 text-white" : "bg-white border border-gray-200"
                )
              }
            >
              {({ checked }) => (
                <>
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-sm">
                        <RadioGroup.Label
                          as="p"
                          className={`font-medium ${checked ? "text-white" : "text-gray-900"}`}
                        >
                          {carrier.name}
                        </RadioGroup.Label>
                        <RadioGroup.Description
                          as="span"
                          className={`inline ${checked ? "text-sky-100" : "text-gray-500"}`}
                        >
                          <span>{carrier.id}</span>
                        </RadioGroup.Description>
                      </div>
                    </div>
                    {checked && (
                      <div className="shrink-0 text-white">
                        <CheckCircleSolid />
                      </div>
                    )}
                  </div>
                </>
              )}
            </RadioGroup.Option>
          ))}
        </div>
      </RadioGroup>
    </div>
  )
}

export default ShippingCarrier