// my-medusa-store-storefront\src\modules\checkout\components\payment\index.tsx

"use client"

import { RadioGroup } from "@headlessui/react"
import { initiatePaymentSession } from "@lib/data/cart"
import { CheckCircleSolid, CreditCard, Cash } from "@medusajs/icons"
import { Button, Container, Heading, Text, clx } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, {
  StripeCardContainer,
} from "@modules/checkout/components/payment-container"
import Divider from "@modules/common/components/divider"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState, useMemo } from "react"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

const UI_OPTIONS = {
  PREPAID: {
    id: "pp_system_default", 
    label: "PREPAID (Chuyển khoản / Ví điện tử)",
    icon: <CreditCard />,
  },
  COD: {
    id: "cod_virtual", 
    label: "Ship COD (Cash on Delivery)",
    icon: <Cash />,
  }
}

const isStripeLike = (providerId?: string) => {
  return providerId?.startsWith("pp_stripe_") || providerId?.startsWith("pp_medusa-")
}

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: any
  availablePaymentMethods: any[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession: any) => paymentSession.status === "pending"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)

  // 1. Logic danh sách hiển thị
  const displayMethods = useMemo(() => {
    if (!availablePaymentMethods) return []
    const methods: any[] = []
    
    availablePaymentMethods.forEach(m => {
      if (m.id === 'pp_system_default') {
        methods.push({ ...m, id: UI_OPTIONS.PREPAID.id, ui_info: UI_OPTIONS.PREPAID }) 
        methods.push({ ...m, id: UI_OPTIONS.COD.id, ui_info: UI_OPTIONS.COD })         
      } else {
        methods.push({ ...m, ui_info: { label: m.id, icon: <CreditCard/> } }) 
      }
    })
    return methods
  }, [availablePaymentMethods])

  // Lấy trạng thái ban đầu từ cart
  const initialMethodId = cart.metadata?.payment_type === 'cod' 
      ? UI_OPTIONS.COD.id 
      : (activeSession?.provider_id || "");

  const [selectedMethodId, setSelectedMethodId] = useState(initialMethodId)

  // [MỚI] State để lưu loại thanh toán vừa submit (Dùng để hiển thị ngay lập tức)
  const [submittedPaymentType, setSubmittedPaymentType] = useState<string | null>(
      cart.metadata?.payment_type || null
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOpen = searchParams.get("step") === "payment"

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), { scroll: false })
  }

  const handleSelectMethod = async (methodId: string) => {
    setError(null)
    setSelectedMethodId(methodId)
    if (isStripeLike(methodId)) {
      await initiatePaymentSession(cart, { provider_id: methodId })
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const isCodSelection = selectedMethodId === UI_OPTIONS.COD.id
      const isPrepaidSelection = selectedMethodId === UI_OPTIONS.PREPAID.id
      
      const realProviderId = (isCodSelection || isPrepaidSelection) 
        ? 'pp_system_default' 
        : selectedMethodId

      // 1. Cập nhật Metadata (QUAN TRỌNG: Cần await để chắc chắn lưu thành công)
      if (isCodSelection || isPrepaidSelection) {
          const typeValue = isCodSelection ? 'cod' : 'prepaid';
          
          // Cập nhật State hiển thị ngay lập tức (Optimistic UI update)
          setSubmittedPaymentType(typeValue); 

          const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";
          await fetch(`${BACKEND_URL}/store/carts/${cart.id}`, {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "x-publishable-api-key": publishableKey
              },
              body: JSON.stringify({
                  metadata: {
                      payment_type: typeValue
                  }
              })
          })
      }

      // 2. Init session nếu cần
      if (activeSession?.provider_id !== realProviderId) {
          await initiatePaymentSession(cart, { provider_id: realProviderId })
      }

      const isManual = isCodSelection || isPrepaidSelection;
      const shouldInputCard = isStripeLike(realProviderId) && !activeSession

      if (isManual || !shouldInputCard) {
        // [MỚI] Refresh router để Server Component lấy dữ liệu mới nhất cho bước Review
        router.refresh() 
        
        return router.push(
          pathname + "?" + createQueryString("step", "review"),
          { scroll: false }
        )
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { setError(null) }, [isOpen])

  const paidByGiftcard = cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0
  const paymentReady = (activeSession && cart?.shipping_methods.length !== 0) || paidByGiftcard

  // [LOGIC HIỂN THỊ TÓM TẮT ĐƯỢC CẬP NHẬT]
  // Ưu tiên sử dụng state submittedPaymentType (vừa chọn xong) -> rồi mới đến cart.metadata
  const currentPaymentType = submittedPaymentType || cart.metadata?.payment_type;

  const summaryLabel = currentPaymentType === 'cod' 
      ? UI_OPTIONS.COD.label 
      : UI_OPTIONS.PREPAID.label;

  const summaryIcon = currentPaymentType === 'cod'
      ? UI_OPTIONS.COD.icon
      : UI_OPTIONS.PREPAID.icon;

  const summaryDetail = currentPaymentType === 'cod'
    ? "Cash on Delivery"
    : "Prepaid Payment";
    
  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            { "opacity-50 pointer-events-none select-none": !isOpen && !paymentReady }
          )}
        >
          Payment
          {!isOpen && paymentReady && <CheckCircleSolid />}
        </Heading>
        {!isOpen && paymentReady && (
          <Text>
            <button onClick={handleEdit} className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover" data-testid="edit-payment-button">
              Edit
            </button>
          </Text>
        )}
      </div>
      <div>
        <div className={isOpen ? "block" : "hidden"}>
          {!paidByGiftcard && displayMethods?.length > 0 && (
            <RadioGroup value={selectedMethodId} onChange={handleSelectMethod}>
              {displayMethods.map((paymentMethod) => {
                const isStripe = isStripeLike(paymentMethod.id)
                const info = paymentMethod.ui_info || {}

                return (
                  <div key={paymentMethod.id} className="mb-2">
                    {isStripe ? (
                      <StripeCardContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedMethodId}
                        paymentInfoMap={{}} 
                        setCardBrand={setCardBrand}
                        setError={setError}
                        setCardComplete={setCardComplete}
                      />
                    ) : (
                      <RadioGroup.Option
                        value={paymentMethod.id}
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
                          <div className={clx("w-5 h-5 rounded-full border flex items-center justify-center", selectedMethodId === paymentMethod.id ? "border-blue-600" : "border-gray-300")}>
                             {selectedMethodId === paymentMethod.id && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"/>}
                          </div>
                          <div className="flex flex-col">
                             <span className="text-base-regular text-gray-900">{info.label}</span>
                          </div>
                        </div>
                        <span className="justify-self-end text-ui-fg-base">
                           {info.icon}
                        </span>
                      </RadioGroup.Option>
                    )}
                  </div>
                )
              })}
            </RadioGroup>
          )}

          {paidByGiftcard && (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">Payment method</Text>
              <Text className="txt-medium text-ui-fg-subtle">Gift card</Text>
            </div>
          )}

          <ErrorMessage error={error} data-testid="payment-method-error-message" />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!selectedMethodId && !paidByGiftcard}
            data-testid="submit-payment-button"
          >
            Continue to review
          </Button>
        </div>

        <div className={isOpen ? "hidden" : "block"}>
          {cart && paymentReady && activeSession ? (
            <div className="flex items-start gap-x-1 w-full">
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">Payment method</Text>
                <Text className="txt-medium text-ui-fg-subtle" data-testid="payment-method-summary">
                  {/* Hiển thị label đúng */}
                  {summaryLabel}
                </Text>
              </div>
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">Payment details</Text>
                <div className="flex gap-2 txt-medium text-ui-fg-subtle items-center">
                  <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                    {summaryIcon}
                  </Container>
                  <Text>
                    {isStripeLike(selectedMethodId) ? cardBrand : summaryDetail}
                  </Text>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default Payment