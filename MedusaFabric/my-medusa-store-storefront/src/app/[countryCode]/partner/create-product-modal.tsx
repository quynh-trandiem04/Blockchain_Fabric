"use client"

import { useState } from "react"
import { XMark, Photo, Plus, Trash, CheckCircle, Spinner } from "@medusajs/icons"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

// Predefined sizes and colors
const BASIC_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]
const BASIC_COLORS = [
    { name: "Black", hex: "#000000" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Gray", hex: "#9CA3AF" },
    { name: "Red", hex: "#EF4444" },
    { name: "Blue", hex: "#3B82F6" },
    { name: "Green", hex: "#10B981" },
    { name: "Yellow", hex: "#F59E0B" },
    { name: "Pink", hex: "#EC4899" },
    { name: "Purple", hex: "#A855F7" },
    { name: "Navy", hex: "#1E3A8A" },
]

interface Variant {
    size: string
    color: string
    inventory: number
}

interface CreateProductModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function CreateProductModal({ isOpen, onClose, onSuccess }: CreateProductModalProps) {
    // Basic Info
    const [title, setTitle] = useState("")
    const [subtitle, setSubtitle] = useState("")
    const [description, setDescription] = useState("")
    const [handle, setHandle] = useState("")
    const [price, setPrice] = useState("")
    const [images, setImages] = useState<string[]>([])
    const [imageInput, setImageInput] = useState("")

    // Variants
    const [selectedSizes, setSelectedSizes] = useState<string[]>([])
    const [selectedColors, setSelectedColors] = useState<string[]>([])
    const [customSize, setCustomSize] = useState("")
    const [customColor, setCustomColor] = useState("")
    const [variants, setVariants] = useState<Variant[]>([])

    const [isCreating, setIsCreating] = useState(false)

    if (!isOpen) return null

    const handleAddImage = () => {
        if (imageInput.trim() && !images.includes(imageInput.trim())) {
            setImages([...images, imageInput.trim()])
            setImageInput("")
        }
    }

    const handleRemoveImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index))
    }

    const handleAddCustomSize = () => {
        if (customSize.trim() && !selectedSizes.includes(customSize.trim())) {
            const newSizes = [...selectedSizes, customSize.trim()]
            setSelectedSizes(newSizes)
            updateVariantsFromSelections(newSizes, selectedColors)
            setCustomSize("")
        }
    }

    const handleAddCustomColor = () => {
        if (customColor.trim() && !selectedColors.includes(customColor.trim())) {
            const newColors = [...selectedColors, customColor.trim()]
            setSelectedColors(newColors)
            updateVariantsFromSelections(selectedSizes, newColors)
            setCustomColor("")
        }
    }

    const toggleSize = (size: string) => {
        const newSizes = selectedSizes.includes(size)
            ? selectedSizes.filter(s => s !== size)
            : [...selectedSizes, size]
        setSelectedSizes(newSizes)
        updateVariantsFromSelections(newSizes, selectedColors)
    }

    const toggleColor = (color: string) => {
        const newColors = selectedColors.includes(color)
            ? selectedColors.filter(c => c !== color)
            : [...selectedColors, color]
        setSelectedColors(newColors)
        updateVariantsFromSelections(selectedSizes, newColors)
    }

    const updateVariantsFromSelections = (sizes: string[], colors: string[]) => {
        const newVariants: Variant[] = []

        if (sizes.length === 0 && colors.length === 0) {
            setVariants([])
        } else if (sizes.length === 0) {
            // Only colors
            colors.forEach(color => {
                const existing = variants.find(v => v.size === "Default" && v.color === color)
                newVariants.push({
                    size: "Default",
                    color,
                    inventory: existing?.inventory || 10
                })
            })
        } else if (colors.length === 0) {
            // Only sizes
            sizes.forEach(size => {
                const existing = variants.find(v => v.size === size && v.color === "Default")
                newVariants.push({
                    size,
                    color: "Default",
                    inventory: existing?.inventory || 10
                })
            })
        } else {
            // Both sizes and colors
            sizes.forEach(size => {
                colors.forEach(color => {
                    const existing = variants.find(v => v.size === size && v.color === color)
                    newVariants.push({
                        size,
                        color,
                        inventory: existing?.inventory || 10
                    })
                })
            })
        }

        setVariants(newVariants)
    }

    const updateVariantInventory = (index: number, inventory: number) => {
        const updated = [...variants]
        updated[index].inventory = inventory
        setVariants(updated)
    }

    const handleSubmit = async () => {
        if (!title || !price) {
            alert("Title and Price are required!")
            return
        }

        setIsCreating(true)
        const token = localStorage.getItem("medusa_token")
        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

        try {
            const payload: any = {
                title,
                subtitle,
                description,
                handle: handle || undefined,
                price: parseInt(price),
                inventory_quantity: 10,
                images: images.map(url => ({ url }))
            }

            console.log("📸 Images being sent:", payload.images)

            if (variants.length > 0) {
                // Determine if we have sizes, colors, or both
                const hasSizes = selectedSizes.length > 0
                const hasColors = selectedColors.length > 0

                const options: any[] = []
                if (hasSizes) options.push({ title: "Size", values: selectedSizes })
                if (hasColors) options.push({ title: "Color", values: selectedColors })

                payload.options = options
                payload.variants = variants.map(v => {
                    const variantOptions: any = {}
                    if (hasSizes && v.size !== "Default") variantOptions.Size = v.size
                    if (hasColors && v.color !== "Default") variantOptions.Color = v.color

                    return {
                        title: `${v.size !== "Default" ? v.size : ""}${v.size !== "Default" && v.color !== "Default" ? " / " : ""}${v.color !== "Default" ? v.color : ""}`.trim() || "Default",
                        options: variantOptions,
                        inventory_quantity: v.inventory
                    }
                })
            }

            const res = await fetch(`${BACKEND_URL}/store/market/products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-publishable-api-key": publishableKey
                },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                alert("Product created successfully!")
                onSuccess()
                resetForm()
                onClose()
            } else {
                const error = await res.json()
                alert(`Error: ${error.message || "Failed to create product"}`)
            }
        } catch (err) {
            alert("Connection error")
        } finally {
            setIsCreating(false)
        }
    }

    const resetForm = () => {
        setTitle("")
        setSubtitle("")
        setDescription("")
        setHandle("")
        setPrice("")
        setImages([])
        setImageInput("")
        setSelectedSizes([])
        setSelectedColors([])
        setCustomSize("")
        setCustomColor("")
        setVariants([])
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-600 to-gray-500 px-8 py-6 border-b border-gray-500 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Create New Product</h2>
                        <p className="text-sm text-gray-300 mt-1">Fill in all product details below</p>
                    </div>
                    <button onClick={onClose} className="text-gray-300 hover:text-white transition p-2 rounded-lg hover:bg-gray-700">
                        <XMark className="w-6 h-6" />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-5xl mx-auto space-y-8">{/* Basic Info Section */}
                        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-100">Basic Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-800 mb-2">Product Title *</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-gray-600 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white"
                                        placeholder="e.g., Premium Cotton T-Shirt"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-800 mb-2">Subtitle</label>
                                    <input
                                        type="text"
                                        value={subtitle}
                                        onChange={(e) => setSubtitle(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-gray-600 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white"
                                        placeholder="Short description"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-800 mb-2">Handle (URL)</label>
                                    <input
                                        type="text"
                                        value={handle}
                                        onChange={(e) => setHandle(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-gray-600 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white"
                                        placeholder="auto-generated if empty"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-800 mb-2">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={4}
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-gray-600 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white resize-none"
                                        placeholder="Detailed product description..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-800 mb-2">Base Price (cents) *</label>
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

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <Photo className="w-5 h-5" />
                                        Product Images (URLs)
                                    </label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={imageInput}
                                            onChange={(e) => setImageInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddImage()}
                                            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-gray-600 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white"
                                            placeholder="https://example.com/image.jpg"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddImage}
                                            className="px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold text-sm flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add
                                        </button>
                                    </div>
                                    {images.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {images.map((url, idx) => (
                                                <div key={idx} className="relative group">
                                                    <img src={url} alt={`Product ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border-2 border-gray-200" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(idx)}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <XMark className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Variants Section - Sizes & Colors */}
                        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-100">Product Variants</h3>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Sizes */}
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 mb-4">Sizes</h4>
                                    <p className="text-sm text-gray-600 mb-4">Select from basic sizes or add custom ones:</p>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {BASIC_SIZES.map(size => (
                                            <button
                                                key={size}
                                                type="button"
                                                onClick={() => toggleSize(size)}
                                                className={`px-4 py-2 rounded-lg font-semibold text-sm border-2 transition-all ${selectedSizes.includes(size)
                                                    ? 'bg-gray-600 text-white border-gray-600'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-600'
                                                    }`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={customSize}
                                            onChange={(e) => setCustomSize(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddCustomSize()}
                                            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-gray-600 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white"
                                            placeholder="Add custom size (e.g., 42, 44)"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddCustomSize}
                                            className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-300 transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {selectedSizes.length > 0 && (
                                        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Selected Sizes:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedSizes.map(size => (
                                                    <span key={size} className="px-3 py-1 bg-gray-600 text-white rounded-full text-xs font-semibold flex items-center gap-1">
                                                        {size}
                                                        <button type="button" onClick={() => toggleSize(size)} className="hover:text-red-300">
                                                            <XMark className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Colors */}
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 mb-4">Colors</h4>
                                    <p className="text-sm text-gray-600 mb-4">Select from basic colors or add custom ones:</p>

                                    <div className="grid grid-cols-5 gap-3 mb-4">
                                        {BASIC_COLORS.map(color => (
                                            <button
                                                key={color.name}
                                                type="button"
                                                onClick={() => toggleColor(color.name)}
                                                className={`relative w-full aspect-square rounded-lg border-4 transition-all ${selectedColors.includes(color.name)
                                                    ? 'border-gray-600 scale-110'
                                                    : 'border-gray-200 hover:border-gray-400'
                                                    }`}
                                                style={{ backgroundColor: color.hex }}
                                                title={color.name}
                                            >
                                                {selectedColors.includes(color.name) && (
                                                    <CheckCircle className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 ${color.name === 'White' ? 'text-gray-900' : 'text-white'
                                                        }`} />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={customColor}
                                            onChange={(e) => setCustomColor(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddCustomColor()}
                                            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:border-gray-600 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white"
                                            placeholder="Add custom color (e.g., Burgundy, Teal)"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddCustomColor}
                                            className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-300 transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {selectedColors.length > 0 && (
                                        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Selected Colors:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedColors.map(color => (
                                                    <span key={color} className="px-3 py-1 bg-gray-600 text-white rounded-full text-xs font-semibold flex items-center gap-1">
                                                        {color}
                                                        <button type="button" onClick={() => toggleColor(color)} className="hover:text-red-300">
                                                            <XMark className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Inventory Management Section */}
                        {variants.length > 0 && (
                            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-100">
                                    Inventory Management ({variants.length} variants)
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {variants.map((variant, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-all">
                                            <div className="flex-1 mr-3">
                                                <p className="font-bold text-gray-900 text-sm">
                                                    {variant.size !== "Default" && <span className="bg-gray-600 text-white px-2 py-1 rounded mr-1 text-xs">{variant.size}</span>}
                                                    {variant.color !== "Default" && <span className="bg-gray-600 text-white px-2 py-1 rounded text-xs">{variant.color}</span>}
                                                    {variant.size === "Default" && variant.color === "Default" && <span className="text-gray-500">Default</span>}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={variant.inventory}
                                                    onChange={(e) => updateVariantInventory(idx, parseInt(e.target.value) || 0)}
                                                    className="w-20 border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-center focus:border-gray-600 focus:ring-0 outline-none"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-gray-50 px-8 py-5 border-t-2 border-gray-200 flex items-center justify-between flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl transition-all text-sm"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isCreating || !title || !price}
                        className="px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-500 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                    >
                        {isCreating ? (
                            <>
                                <Spinner className="animate-spin w-5 h-5" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                Create Product
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
