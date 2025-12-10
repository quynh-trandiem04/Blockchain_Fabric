"use client"

import { RadioGroup } from "@headlessui/react"
import { setShippingMethod } from "@lib/data/cart"
import { CheckCircleSolid, Loader } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Button, clx, Heading, Text } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import Divider from "@modules/common/components/divider"
import MedusaRadio from "@modules/common/components/radio"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Custom State: Danh sách Shipper từ API
  const [shippers, setShippers] = useState<any[]>([])
  const [isLoadingShippers, setIsLoadingShippers] = useState(true)

  // State lưu lựa chọn (Dùng ID của Shipper Custom)
  // cart.metadata?.shipper_id là nơi lưu ID shipper thật
  const [selectedShipperId, setSelectedShipperId] = useState<string | null>(
    (cart.metadata?.shipper_id as string) || null
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "delivery"

  // 1. Fetch danh sách Shipper từ API Custom
  useEffect(() => {
    const fetchShippers = async () => {
      setIsLoadingShippers(true)
      try {
        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";
        const res = await fetch(`${BACKEND_URL}/store/market/active-shippers`, {
            headers: { "x-publishable-api-key": publishableKey }
        })
        
        if (res.ok) {
            const data = await res.json()
            setShippers(data.shippers || [])
        }
      } catch (e) {
        console.error("Lỗi tải danh sách vận chuyển:", e)
      } finally {
        setIsLoadingShippers(false)
      }
    }
    fetchShippers()
  }, [])

  const handleEdit = () => {
    router.push(pathname + "?step=delivery", { scroll: false })
  }

  const handleSubmit = () => {
    if (!selectedShipperId) {
        setError("Vui lòng chọn một đơn vị vận chuyển.")
        return
    }
    router.push(pathname + "?step=payment", { scroll: false })
  }

  // 2. Logic set Shipping Method (Mapping)
  const handleSetShippingMethod = async (shipperId: string) => {
    setError(null)
    setIsLoading(true)
    setSelectedShipperId(shipperId)

    // A. Lấy Option "mồi" từ Medusa (Standard/Express)
    const defaultOptionId = availableShippingMethods?.[0]?.id;

    if (!defaultOptionId) {
        setError("Lỗi cấu hình: Không tìm thấy phương thức vận chuyển nền.")
        setIsLoading(false)
        return
    }

    try {
        // B. Set Shipping Method "mồi" cho Medusa
        await setShippingMethod({ cartId: cart.id, shippingMethodId: defaultOptionId })

        // C. Lưu ID Shipper thật vào Metadata của Cart
        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";
        await fetch(`${BACKEND_URL}/store/carts/${cart.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-publishable-api-key": publishableKey
            },
            body: JSON.stringify({
                metadata: {
                    shipper_id: shipperId
                }
            })
        })

        router.refresh()

    } catch (err: any) {
        setError(err.message)
    } finally {
        setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  // Helper format tiền
  const getPrice = (price: number) => {
      const currencyCode = cart.region?.currency_code?.toUpperCase() || "USD";
      try {
          return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: currencyCode,
              maximumFractionDigits: 2
          }).format(price);
      } catch (e) { return `${price}`; }
  }

  // Helper lấy tên Shipper đã chọn
  const getSelectedShipperName = () => {
      if (!selectedShipperId) return "";
      const found = shippers.find(s => s.id === selectedShipperId);
      return found ? found.name : "Đang tải...";
  }

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && !selectedShipperId,
            }
          )}
        >
          Delivery
          {!isOpen && selectedShipperId && (
            <CheckCircleSolid />
          )}
        </Heading>
        {!isOpen &&
          cart?.shipping_address &&
          cart?.billing_address &&
          cart?.email && (
            <Text>
              <button
                onClick={handleEdit}
                className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                data-testid="edit-delivery-button"
              >
                Edit
              </button>
            </Text>
          )}
      </div>
      {isOpen ? (
        <>
          <div className="grid">
            <div className="flex flex-col">
              <span className="font-medium txt-medium text-ui-fg-base">
                Shipping method
              </span>
              <span className="mb-4 text-ui-fg-muted txt-medium">
                How would you like your order delivered
              </span>
            </div>
            <div data-testid="delivery-options-container">
              <div className="pb-8 md:pt-0 pt-2">
                
                {isLoadingShippers ? (
                    <div className="flex items-center gap-2 p-4">
                        <Loader className="animate-spin" /> 
                        <Text className="text-ui-fg-subtle">Loading shippers...</Text>
                    </div>
                ) : (
                    <RadioGroup
                        value={selectedShipperId}
                        // [FIX LỖI TS2345 TẠI ĐÂY]: Kiểm tra v tồn tại trước khi gọi hàm
                        onChange={(v) => v && handleSetShippingMethod(v)}
                    >
                    {shippers.map((shipper) => {
                        return (
                        <RadioGroup.Option
                            key={shipper.id}
                            value={shipper.id}
                            data-testid="delivery-option-radio"
                            className={({ checked }) =>
                            clx(
                                "flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                                {
                                "border-ui-border-interactive": checked,
                                "border-ui-border-base": !checked,
                                }
                            )
                            }
                        >
                            <div className="flex items-center gap-x-4">
                            <MedusaRadio checked={selectedShipperId === shipper.id} />
                            <div className="flex flex-col">
                                <span className="text-base-regular">
                                    {shipper.name}
                                </span>
                                <span className="text-small-regular text-ui-fg-subtle">
                                    Standard delivery
                                </span>
                            </div>
                            </div>
                            <span className="justify-self-end text-ui-fg-base">
                                {getPrice(shipper.price)}
                            </span>
                        </RadioGroup.Option>
                        )
                    })}
                    </RadioGroup>
                )}

                {shippers.length === 0 && !isLoadingShippers && (
                     <div className="text-center py-4 text-ui-fg-subtle">No shippers available.</div>
                )}
                
              </div>
            </div>
          </div>

          <div>
            <ErrorMessage
              error={error}
              data-testid="delivery-option-error-message"
            />
            <Button
              size="large"
              className="mt"
              onClick={handleSubmit}
              isLoading={isLoading}
              disabled={!selectedShipperId}
              data-testid="submit-delivery-option-button"
            >
              Continue to payment
            </Button>
          </div>
        </>
      ) : (
        <div>
          <div className="text-small-regular">
            {selectedShipperId && (
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Method
                </Text>
                <Text className="txt-medium text-ui-fg-subtle">
                  {getSelectedShipperName()}
                </Text>
              </div>
            )}
          </div>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Shipping