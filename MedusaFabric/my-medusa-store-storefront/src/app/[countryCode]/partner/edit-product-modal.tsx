"use client"

import { useState, useEffect } from "react"
import { XMark, CheckCircle, Spinner, CurrencyDollar, ArchiveBox } from "@medusajs/icons"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

interface EditProductModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    product: any
}

export default function EditProductModal({ isOpen, onClose, onSuccess, product }: EditProductModalProps) {
    const [status, setStatus] = useState("published")
    const [price, setPrice] = useState("")
    const [isUpdating, setIsUpdating] = useState(false)
    const [variantInventories, setVariantInventories] = useState<Record<string, number>>({})

    useEffect(() => {
        if (product && isOpen) {
            setStatus(product.status || "published")
            setPrice(product.display_price || "")

            // Initialize variant inventories
            const inventories: Record<string, number> = {}
            if (product.variants) {
                product.variants.forEach((v: any) => {
                    inventories[v.id] = v.inventory_quantity || 0
                })
            }
            setVariantInventories(inventories)
        }
    }, [product, isOpen])

    const handleSubmit = async () => {
        if (!product) return

        setIsUpdating(true)
        const token = localStorage.getItem("medusa_token")
        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

        if (!token) {
            alert("Not authenticated")
            setIsUpdating(false)
            return
        }

        try {
            // Update inventory for each variant FIRST
            console.log("Updating inventory for variants:", variantInventories)

            for (const [variantId, inventory] of Object.entries(variantInventories)) {
                console.log(`Updating variant ${variantId}: ${inventory}`)

                const invRes = await fetch(`${BACKEND_URL}/store/market/products/${product.id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                        "x-publishable-api-key": publishableKey
                    },
                    body: JSON.stringify({
                        variant_id: variantId,
                        inventory: inventory
                    })
                })

                if (!invRes.ok) {
                    const errText = await invRes.text()
                    console.error(`Failed to update inventory for variant ${variantId}:`, errText)
                    throw new Error(`Failed to update inventory for variant`)
                } else {
                    console.log(`Updated inventory for variant ${variantId}`)
                }
            }

            // Update product info (status, price) AFTER inventory
            const productUpdatePayload: any = { status }

            if (price) {
                productUpdatePayload.price = parseInt(price)  // Nhập bao nhiêu gửi bấy nhiêu
            }

            console.log("Updating product info:", productUpdatePayload)

            const res = await fetch(`${BACKEND_URL}/store/market/products/${product.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-publishable-api-key": publishableKey
                },
                body: JSON.stringify(productUpdatePayload)
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.message || "Failed to update product")
            }

            console.log("Product updated successfully")
            alert("Product updated successfully!")
            onSuccess()
            onClose()
        } catch (error: any) {
            console.error("Update error:", error)
            alert("Failed to update product: " + error.message)
        } finally {
            setIsUpdating(false)
        }
    }

    const updateVariantInventory = (variantId: string, qty: number) => {
        setVariantInventories(prev => ({
            ...prev,
            [variantId]: qty
        }))
    }

    if (!isOpen || !product) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col z-50 border-2 border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b-2 border-gray-200 flex justify-between items-center bg-white shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Edit Product</h2>
                        <p className="text-sm text-gray-500 mt-1">{product.title}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 bg-gray-200 p-2 rounded-lg transition-colors">
                        <XMark className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* Status & Price */}
                        <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">Basic Settings</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-800 mb-2">Status</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-4 py-2.5 text-sm font-medium focus:border-gray-900 focus:ring-0 outline-none transition-all bg-white"
                                    >
                                        <option value="published">Published</option>
                                        <option value="draft">Draft</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <CurrencyDollar className="w-4 h-4" />
                                        Base Price (cents)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">¢</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md pl-10 pr-4 py-2.5 text-sm font-medium focus:border-gray-900 focus:ring-0 outline-none transition-all bg-white"
                                            placeholder="200"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Variant Inventory */}
                        {product.variants && product.variants.length > 0 && (
                            <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200 flex items-center gap-2">
                                    <ArchiveBox className="w-5 h-5" />
                                    Inventory Management ({product.variants.length} variants)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {product.variants.map((variant: any) => (
                                        <div key={variant.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 transition-all">
                                            <div className="flex-1 mr-3">
                                                <p className="font-bold text-gray-900 text-sm mb-1">{variant.title}</p>
                                                {variant.options && variant.options.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {variant.options.map((opt: any, idx: number) => (
                                                            <span key={idx} className="bg-gray-900 text-white px-2 py-0.5 rounded text-xs font-semibold">
                                                                {opt.value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={variantInventories[variant.id] || 0}
                                                    onChange={(e) => updateVariantInventory(variant.id, parseInt(e.target.value) || 0)}
                                                    className="w-20 border border-gray-400 rounded-md px-3 py-2 text-sm font-bold text-center focus:border-gray-900 focus:ring-0 outline-none bg-white"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Summary Info */}
                        <div className="bg-gray-100 border border-gray-300 rounded-lg p-5">
                            <p className="text-xs font-bold text-gray-700 uppercase mb-2">💡 Note</p>
                            <p className="text-sm text-gray-900">
                                Changes will be applied to all variants. Price updates affect all currency conversions automatically.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-all text-sm"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={isUpdating}
                        className="px-8 py-2.5 bg-gray-900 text-white font-semibold rounded-md hover:bg-black shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                    >
                        {isUpdating ? (
                            <>
                                <Spinner className="animate-spin w-5 h-5" />
                                Updating...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                Update Product
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
