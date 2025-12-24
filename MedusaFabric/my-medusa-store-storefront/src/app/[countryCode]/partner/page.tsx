// src\app\[countryCode]\partner\page.tsx

"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
// Import Icons
import {
    Photo, Tag, CurrencyDollar, ArchiveBox, XMark, CheckCircle,
    ArrowRightOnRectangle, Spinner, MagnifyingGlass, Funnel,
    ShoppingBag, Tag as TagIcon, Plus, Trash, User, PencilSquare, Clock, ComputerDesktop
} from "@medusajs/icons"
import CreateProductModal from "./create-product-modal"
import EditProductModal from "./edit-product-modal"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

// --- ICONS ---
const Icons = {
    Sort: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M6 12h12m-9 6h6" />
        </svg>
    ),
    Check: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    ),
    XMark: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    )
};

// --- AUDIT TRAIL COMPONENT---
const AuditTrail = ({ history, sellerId, shipperId }: { history: any[], sellerId?: string, shipperId?: string }) => {
    if (!history || !Array.isArray(history) || history.length === 0) {
        return <p className="text-gray-400 italic text-xs">No history recorded.</p>;
    }

    const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Hàm map tên actor
    const getActorName = (org: string) => {
        if (org === 'SellerOrgMSP') return 'Your Shop';
        if (org === 'ShipperOrgMSP') return shipperId || "Shipper";
        if (org === 'ECommercePlatformOrgMSP') return "Platform Admin";
        return org;
    };

    const formatAction = (action: string) => {
        if (!action) return "Unknown";
        const spaced = action.replace(/([A-Z])/g, ' $1').trim(); 
        return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
    };

    return (
        <div className="flex flex-col gap-0 relative ml-2 mt-4">
            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gray-200 -z-10"></div>
            {sortedHistory.map((entry, index) => (
                <div key={index} className="flex gap-4 pb-6 last:pb-0 relative group">
                    <div className="h-8 w-8 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 z-10">
                        <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex flex-col flex-1 pt-1">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">
                                    {formatAction(entry.action)}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 border border-gray-200 font-mono font-medium">
                                        {getActorName(entry.actorOrg)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(entry.timestamp).toLocaleString('en-GB')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {entry.txID && (
                            <div className="mt-1.5 p-1.5 bg-gray-50 rounded border border-gray-100 hover:border-gray-300 transition-colors w-fit">
                                <div className="flex items-center gap-1.5">
                                    <ComputerDesktop className="w-3 h-3 text-gray-400"/>
                                    <span className="font-mono text-[10px] text-gray-500 truncate max-w-[200px]" title={entry.txID}>
                                        Tx: {entry.txID.substring(0, 15)}...
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

interface OrderRow {
    id: string;
    display_id: string;
    created_at: string;
    history?: any[]; 
    seller_id?: string; 
    shipper_id?: string;
    publicData: {
        email: string;
        currency_code: string;
        total: number;
        medusa_status: string;
        medusa_payment: string;
        cod_status?: string;
    };
    status: "Pending" | "Success" | "Error";
    decryptedData: {
        customerName: string;
        shipping_address: string;
        shipping_phone: string;
        items: any[];
        amount_untaxed: number;
        shipping_fee: number;
        cod_amount: number;
        status: string;
        paymentMethod: string;
        codStatus?: string;
        updatedAt?: string;
    } | null;
    error?: string;
}

type SortKey = 'created_at';
type SortDirection = 'asc' | 'desc';

export default function SellerDashboard() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const router = useRouter()
    const params = useParams()

    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [isCheckingRole, setIsCheckingRole] = useState(true)
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [loginError, setLoginError] = useState("")
    const [isLoadingLogin, setIsLoadingLogin] = useState(false)

    const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');

    const [orders, setOrders] = useState<OrderRow[]>([])
    const [isLoadingOrders, setIsLoadingOrders] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
    const [isShipping, setIsShipping] = useState<string | null>(null);
    const [isConfirmingReturn, setIsConfirmingReturn] = useState<string | null>(null);

    const [products, setProducts] = useState<any[]>([])
    const [isLoadingProducts, setIsLoadingProducts] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);

    const [showCreateModal, setShowCreateModal] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [paymentFilter, setPaymentFilter] = useState("ALL");
    const [sortKey, setSortKey] = useState<SortKey>('created_at');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const sortMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
                setShowSortMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatPrice = (amount: number | undefined, currency: string | undefined) => {
        if (amount === undefined || amount === null) return "0";
        const code = (currency || "USD").toUpperCase();
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount);
        } catch (e) { return `${amount} ${code}`; }
    }

    // --- MONOCHROME STATUS BADGES ---
    const getBlockchainStatusBadge = (status: string) => {
        if (!status) return <span className="text-[10px] bg-gray-50 text-gray-400 px-2 py-0.5 border border-gray-200 uppercase font-medium">Syncing...</span>;

        const s = status.toUpperCase();
        let styleClass = "bg-gray-50 text-gray-500 border-gray-200"; // Default

        if (['DELIVERED', 'SETTLED', 'RETURNED'].includes(s)) {
            styleClass = "bg-gray-900 text-white border-gray-900"; // Completed (Dark)
        } else if (['RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'CANCELLED'].includes(s)) {
            styleClass = "bg-gray-100 text-gray-900 border-gray-300 font-bold"; // Alert/Action
        } else if (['PAID', 'SHIPPED'].includes(s)) {
            styleClass = "bg-white text-gray-900 border-gray-300"; // Active
        }

        return (
            <span className={`text-[10px] px-2 py-0.5 border ${styleClass} uppercase tracking-wide font-medium`}>
                {status.replace(/_/g, " ")}
            </span>
        );
    }

    const getPaymentMethodBadge = (method: string) => {
        if (method === 'COD') return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-900 border border-gray-300 uppercase">COD</span>;
        if (method === 'PREPAID') return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white text-gray-900 border border-gray-300 uppercase">PREPAID</span>;
        return <span className="text-[10px] text-gray-400 uppercase">{method}</span>;
    }

    // --- LOGIC FILTER & SORT (ONLY CREATED_AT) ---
    const processedOrders = useMemo(() => {
        let filtered = orders.filter(o => {
            const status = o.decryptedData?.status || "";
            const payment = o.decryptedData?.paymentMethod || "";
            const matchSearch =
                o.display_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.publicData.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (o.decryptedData?.shipping_phone || "").includes(searchQuery);

            const matchStatus = statusFilter === "ALL" || status === statusFilter;
            const matchPayment = paymentFilter === "ALL" || payment === paymentFilter;

            return matchSearch && matchStatus && matchPayment;
        });

        return filtered.sort((a, b) => {
            // Only sort by created_at
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();

            if (timeA < timeB) return sortDir === 'asc' ? -1 : 1;
            if (timeA > timeB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [orders, searchQuery, statusFilter, paymentFilter, sortKey, sortDir]);

    // --- ACTIONS ---
    const checkUserRole = async (token: string) => {
        setIsCheckingRole(true);
        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

        try {
            const res = await fetch(`${BACKEND_URL}/store/market/seller-me`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "x-publishable-api-key": publishableKey
                }
            })

            // Nếu Token lỗi (User khách hoặc hết hạn) -> Redirect về trang mua hàng
            if (!res.ok) {
                console.warn("Auth failed or token expired");
                localStorage.removeItem("medusa_token");
                setIsAuthorized(false);
                setIsLoggedIn(false);
                return;
            }

            const { user } = await res.json()
            const role = user.metadata?.fabric_role;
            const status = user.metadata?.approver_status;

            if (role !== 'sellerorgmsp') {
                alert("This account is not authorized as a Seller.");
                setIsAuthorized(false);
            } else if (status === 'pending') {
                alert("This account is still pending approval.");
                setIsAuthorized(false);
            } else if (status === 'rejected') {
                alert("This account has been rejected.");
                setIsAuthorized(false);
            } else {
                setIsAuthorized(true)
                loadData(token)
            }
        } catch (e) {
            console.error("Connection error:", e);
            setIsAuthorized(false)
        } finally {
            setIsCheckingRole(false)
        }
    }

    const loadData = (token: string) => {
        loadSellerOrders(token);
        loadSellerProducts(token);
    }

    const loadSellerOrders = async (tokenOverride?: string) => {
        console.log("loadSellerOrders...")
        setIsLoadingOrders(true)
        const token = tokenOverride || localStorage.getItem("medusa_token")
        if (!token) return

        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

        try {
            // GỌI API LIST MỚI TỪ BLOCKCHAIN
            const res = await fetch(`${BACKEND_URL}/store/fabric/orders/list`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "x-publishable-api-key": publishableKey
                }
            })

            if (res.ok) {
                const { orders: rawOrders } = await res.json()

                console.log(`[Frontend Debug] Orders received count (Fabric): ${rawOrders.length}`);

                const mappedOrders: OrderRow[] = []

                await Promise.all(
                    rawOrders.map(async (order: any) => {
                        const row: OrderRow = {
                            id: order.id,
                            display_id: `#${order.display_id}`,
                            created_at: order.created_at,
                            history: order.history || [], 
                            seller_id: order.seller_id || order.publicData?.seller_id,
                            shipper_id: order.shipper_id || order.publicData?.shipper_id, 
                            
                            publicData: {
                                email: order.publicData.email || "Loading...",
                                total: order.publicData.total || 0,
                                currency_code: order.publicData.currency_code || "USD",
                                medusa_status: order.publicData.medusa_status,
                                medusa_payment: order.publicData.medusa_payment,
                                cod_status: order.publicData.cod_status
                            },
                            status: "Pending",
                            decryptedData: null
                        }

                        try {
                            const resDecrypt = await fetch(`${BACKEND_URL}/store/fabric/orders/${order.id}/decrypt/seller`, {
                                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "x-publishable-api-key": publishableKey }
                            })
                            if (resDecrypt.ok) {
                                const data = await resDecrypt.json();
                                row.status = "Success";
                                row.decryptedData = data;

                                if (data) {
                                    row.publicData.email = data.customerName || row.publicData.email;
                                    row.publicData.total = data.amount_total || data.amount_untaxed || 0;

                                    // Update status cho chính xác nhất
                                    if (data.status) {
                                        row.publicData.medusa_status = data.status;
                                        if (row.decryptedData) row.decryptedData.status = data.status;
                                    }

                                    // Cập nhật Payment sau khi decrypt nếu có
                                    if (data.paymentMethod) {
                                        row.publicData.medusa_payment = data.paymentMethod;
                                    }
                                }
                            } else {
                                const errorData = await resDecrypt.json();
                                console.warn(`[Frontend] Decrypt FAILED for ${order.id}.`);
                                row.status = "Error"
                                row.error = errorData.error || "Syncing...";
                            }
                        } catch (e) {
                            console.error(`[Frontend] Network Error during Decrypt for ${order.id}`, e);
                            row.status = "Error"
                        }
                        mappedOrders.push(row)
                    })
                )
                // Default sort desc by created_at
                const sorted = mappedOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setOrders(sorted);

                if (selectedOrder) {
                    const updated = sorted.find(o => o.id === selectedOrder.id);
                    if (updated) setSelectedOrder(updated);
                }
            }
        } catch (err) { } finally { setIsLoadingOrders(false) }
    }

    const loadSellerProducts = async (tokenOverride?: string) => {
        setIsLoadingProducts(true)
        const token = tokenOverride || localStorage.getItem("medusa_token")
        if (!token) {
            setIsLoadingProducts(false)
            return
        }

        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

        try {
            // 1) lấy list trước
            const res = await fetch(`${BACKEND_URL}/store/market/products/list`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "x-publishable-api-key": publishableKey,
                },
            })

            if (!res.ok) return

            const data = await res.json()
            const list = data.products || []

            // Không enrich lại, chỉ lấy trực tiếp display_inventory từ API /list
            setProducts(list)
        } catch (err) {
            console.error("loadSellerProducts error", err)
        } finally {
            setIsLoadingProducts(false)
        }
    }


    const handleConfirmReturn = async (orderId: string) => {
        if (!confirm("Confirm that you have received the returned item from the Shipper?")) return;

        setIsConfirmingReturn(orderId);
        const token = localStorage.getItem("medusa_token");
        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

        try {
            const res = await fetch(`${BACKEND_URL}/store/fabric/orders/${orderId}/confirm-return`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-publishable-api-key": publishableKey
                }
            });

            const result = await res.json();

            if (res.ok) {
                alert("Success! Return confirmed.");
                loadSellerOrders(token || "");
                if (selectedOrder?.id === orderId) setSelectedOrder(null); // Đóng modal
            } else {
                alert("Error: " + (result.message || "Failed"));
            }
        } catch (err) {
            alert("Error connecting to server");
        } finally {
            setIsConfirmingReturn(null);
        }
    }

    // --- AUTH FLOW ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); setLoginError(""); setIsLoadingLogin(true);
        try {
            const res = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password })
            })
            const data = await res.json()
            if (res.ok && data.token) {
                localStorage.setItem("medusa_token", data.token)
                setIsLoggedIn(true)
                await checkUserRole(data.token);
            } else { setLoginError("Email or password is incorrect."); }
        } catch (err) { setLoginError("Error connecting to server."); }
        finally { setIsLoadingLogin(false); }
    }

    const handleLogout = () => { localStorage.removeItem("medusa_token"); window.location.reload(); }

    useEffect(() => {
        const token = localStorage.getItem("medusa_token")
        if (token) { setIsLoggedIn(true); checkUserRole(token); }
        else { setIsCheckingRole(false); setIsLoggedIn(false); }
    }, [])

    if (isCheckingRole) return <div className="h-screen flex items-center justify-center"><Spinner className="animate-spin text-gray-800 w-8 h-8" /></div>

    if (!isLoggedIn || !isAuthorized) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                <div className="text-center mb-8">
                    <div className="w-10 h-10 bg-gray-900 rounded-md text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">S</div>
                    <h2 className="text-xl font-semibold text-gray-900">Seller Portal</h2>
                    <p className="text-gray-500 text-sm mt-1">Log in to manage your store</p>
                </div>
                {isLoggedIn && !isAuthorized && (
                    <div className="mb-6 p-3 bg-gray-50 text-gray-600 text-sm border border-gray-200 flex items-center gap-2">
                        <XMark className="w-4 h-4" /> No access rights.
                    </div>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-md text-sm focus:border-gray-500 focus:ring-0 outline-none transition" placeholder="shop@example.com" required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-md text-sm focus:border-gray-500 focus:ring-0 outline-none transition" placeholder="••••••••" required />
                    </div>
                    {loginError && <div className="text-red-600 text-sm">{loginError}</div>}
                    <button type="submit" disabled={isLoadingLogin} className="w-full bg-gray-900 text-white p-2.5 rounded-md hover:bg-black font-medium transition shadow-sm text-sm">
                        {isLoadingLogin ? <Spinner className="animate-spin text-white w-4 h-4 mx-auto" /> : "Log in"}
                    </button>
                    {isLoggedIn && <button type="button" onClick={handleLogout} className="w-full text-center text-gray-500 text-xs hover:text-gray-900 mt-2 uppercase tracking-wide font-medium">Log out</button>}
                </form>

                <div className="mt-6 text-center text-gray-600">
                    <p className="text-sm">
                        Don't have an account?{" "}
                        <button
                            onClick={() => router.push("/dk/partner/register")}
                            className="text-gray-900 font-semibold hover:underline hover:text-gray-700 transition"
                        >
                            Register
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900 text-sm">

            {/* SIDEBAR (Monochrome & Inter Font Style) */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-900 rounded-md text-white flex items-center justify-center font-bold text-lg shadow-sm">S</div>
                    <div>
                        <h1 className="text-sm font-semibold text-gray-900">Seller Portal</h1>
                        <p className="text-[10px] text-gray-500 font-medium tracking-wide">Dashboard</p>
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                        <ShoppingBag className="w-4 h-4" /> Orders
                    </button>
                    <button onClick={() => setActiveTab('products')} className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'products' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                        <TagIcon className="w-4 h-4" /> Products
                    </button>
                </nav>
                <div className="p-4 border-t border-gray-100 bg-gray-50/30">
                    <div className="flex items-center gap-3 px-3 py-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><User className="w-3 h-3" /></div>
                        <div className="text-xs text-gray-500 font-medium truncate w-32">User Account</div>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-1.5 text-gray-500 hover:text-gray-900 rounded-md transition text-xs font-medium">
                        <ArrowRightOnRectangle className="w-3 h-3" /> Log out
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 ml-64 p-8 bg-gray-50 min-h-screen">

                {/* TAB: ORDERS */}
                {activeTab === 'orders' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Orders</h1>
                                <p className="text-sm text-gray-500 mt-1">Manage and track your incoming orders.</p>
                            </div>
                            <button onClick={() => loadSellerOrders()} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition">
                                <span className={isLoadingOrders ? "animate-spin" : ""}>⟳</span>
                            </button>
                        </div>

                        {/* Filters & Sort */}
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6 flex items-center p-1">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-2.5 text-gray-400"><MagnifyingGlass /></span>
                                <input placeholder="Search orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border-none focus:ring-0 outline-none h-full bg-transparent placeholder-gray-400 text-gray-900" />
                            </div>
                            <div className="w-px h-6 bg-gray-200 mx-2"></div>
                            <div className="flex items-center px-2 gap-2">
                                <Funnel className="text-gray-400 w-4 h-4" />
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border-none focus:ring-0 outline-none bg-transparent text-gray-600 cursor-pointer font-medium hover:text-gray-900 transition">
                                    <option value="ALL">All Statuses</option>
                                    <option value="CREATED">Created</option>
                                    <option value="PAID">Paid</option>
                                    <option value="SHIPPED">Shipped</option>
                                    <option value="DELIVERED">Delivered</option>
                                    <option value="RETURN_REQUESTED">Return Requested</option>
                                    <option value="RETURN_IN_TRANSIT">Return In Transit)</option>
                                    <option value="RETURNED">Returned )</option>
                                    <option value="DELIVERED_COD_PENDING">Delivered (COD Pending)</option>
                                    <option value="COD_REMITTED">COD Remitted</option>
                                    <option value="SETTLED">Settled</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>
                            <div className="w-px h-6 bg-gray-200 mx-2"></div>

                            {/* Sort Menu */}
                            <div className="relative mr-2" ref={sortMenuRef}>
                                <button onClick={() => setShowSortMenu(!showSortMenu)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md font-medium flex items-center gap-1 transition">
                                    Sort <Icons.Sort />
                                </button>
                                {showSortMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-100">
                                        <div className="px-3 py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide border-b border-gray-100">Sort By</div>
                                        <button onClick={() => { setSortKey('created_at'); setShowSortMenu(false); }} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortKey === 'created_at' ? 'font-medium text-gray-900' : 'text-gray-600'}`}>Created Date</button>
                                        <div className="h-px bg-gray-100 my-1"></div>
                                        <div className="px-3 py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide border-b border-gray-100">Order</div>
                                        <button onClick={() => { setSortDir('desc'); setShowSortMenu(false); }} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortDir === 'desc' ? 'font-medium text-gray-900' : 'text-gray-600'}`}>Newest First</button>
                                        <button onClick={() => { setSortDir('asc'); setShowSortMenu(false); }} className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortDir === 'asc' ? 'font-medium text-gray-900' : 'text-gray-600'}`}>Oldest First</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Order ID</th>
                                        <th className="px-6 py-3 font-medium">Created Date</th>
                                        <th className="px-6 py-3 font-medium">Customer</th>
                                        <th className="px-6 py-3 font-medium">Status</th>
                                        <th className="px-6 py-3 font-medium text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {processedOrders.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">No orders found.</td></tr>
                                    ) : processedOrders.map(order => (
                                        <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{order.display_id}</td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-gray-900">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{order.decryptedData?.customerName || "Guest"}</span>
                                                    {/* <span className="text-xs text-gray-400">{order.publicData.email}</span> */}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {/* HIỂN THỊ CẢ STATUS VÀ COD STATUS (UPDATE CHO PUBLIC DATA) */}
                                                <div className="flex flex-col gap-1 items-start">
                                                    {getBlockchainStatusBadge(order.publicData.medusa_status)}

                                                    <div className="flex gap-1">
                                                        {getPaymentMethodBadge(order.publicData.medusa_payment)}

                                                        {order.publicData.medusa_payment === 'COD' && (
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${order.publicData.cod_status === 'REMITTED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                                                {order.publicData.cod_status || 'PENDING'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">
                                                {order.decryptedData ? formatPrice(order.decryptedData.amount_untaxed, order.publicData.currency_code) : "..."}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                                <span>Showing {processedOrders.length} results</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: PRODUCTS */}
                {activeTab === 'products' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Products</h1>
                                <p className="text-sm text-gray-500 mt-1">Manage your product inventory</p>
                            </div>
                            <button onClick={() => setShowCreateModal(true)} className="px-3 py-1.5 bg-gray-900 text-white rounded-md shadow-sm text-xs font-medium hover:bg-gray-800 flex items-center gap-2 transition">
                                <Plus className="w-3 h-3" /> Add Product
                            </button>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3 w-1/2">Product Information</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Stock</th>
                                        <th className="px-6 py-3 text-right">Sale Price</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {products.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-16 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-xl"><TagIcon /></div>
                                            <p>No products found.</p>
                                        </td></tr>
                                    ) : products.map((p: any) => (
                                        <tr key={p.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedProduct(p)}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 overflow-hidden relative">
                                                        {p.thumbnail ? (
                                                            <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Photo className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{p.title}</div>
                                                        <div className="text-xs text-gray-500 font-mono mt-0.5">{p.handle}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${p.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                                                {/* Hiển thị tồn kho từ metadata */}
                                                {p.display_inventory ?? 0} in stock
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">
                                                {/* Hiển thị giá từ metadata */}
                                                {p.display_price ? `$${p.display_price}` : "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* --- MODAL TẠO SẢN PHẨM (ADVANCED UI WITH SIZE & COLOR VARIANTS) --- */}
            <CreateProductModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    const token = localStorage.getItem("medusa_token")
                    if (token) loadSellerProducts(token)
                }}
            />

            {/* --- MODAL SỬA SẢN PHẨM --- */}
            <EditProductModal
                isOpen={!!editingProduct}
                onClose={() => setEditingProduct(null)}
                onSuccess={() => {
                    const token = localStorage.getItem("medusa_token")
                    if (token) loadSellerProducts(token)
                }}
                product={editingProduct}
            />

            {/* MODAL PRODUCT DETAIL */}
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedProduct(null)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col z-50 border-2 border-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-6 border-b-2 border-gray-100 flex justify-between items-start bg-gradient-to-br from-gray-50 to-white shrink-0">
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-xl border-2 border-gray-200 flex items-center justify-center text-gray-400 overflow-hidden">
                                    {selectedProduct.thumbnail ? (
                                        <img src={selectedProduct.thumbnail} alt={selectedProduct.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <Photo className="w-6 h-6" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{selectedProduct.title}</h2>
                                    <p className="text-sm text-gray-500 mt-1">{selectedProduct.subtitle || 'No subtitle'}</p>
                                    <p className="text-xs text-gray-400 font-mono mt-1">Handle: {selectedProduct.handle}</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-xl transition-colors">
                                <XMark className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-6">
                                {/* Basic Info */}
                                <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b-2 border-gray-100">Basic Information</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Status</p>
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${selectedProduct.status === 'published'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                                }`}>
                                                {selectedProduct.status}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Price</p>
                                            <p className="text-lg font-bold text-gray-900">
                                                {selectedProduct.display_price ? `$${selectedProduct.display_price}` : 'Not set'}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</p>
                                            <p className="text-gray-700">{selectedProduct.description || 'No description provided'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Images */}
                                {selectedProduct.images && selectedProduct.images.length > 0 && (
                                    <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b-2 border-gray-100">Product Images</h3>
                                        <div className="grid grid-cols-4 gap-3">
                                            {selectedProduct.images.map((img: any, idx: number) => (
                                                <div key={idx} className="aspect-square bg-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden">
                                                    <img src={img.url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Variants & Inventory */}
                                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                                    <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b-2 border-gray-100">
                                            Product Variants ({selectedProduct.variants.length})
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedProduct.variants.map((variant: any, idx: number) => (
                                                <div key={variant.id || idx} className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <p className="font-bold text-gray-900">{variant.title}</p>
                                                        </div>
                                                        {variant.options && variant.options.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {variant.options.map((opt: any, optIdx: number) => (
                                                                    <span key={optIdx} className="px-2 py-1 bg-gray-600 text-white rounded text-xs font-semibold">
                                                                        {opt.value}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 ml-4">
                                                        {variant.prices && variant.prices.length > 0 && (
                                                            <div className="text-right">
                                                                <p className="text-xs text-gray-500 font-semibold uppercase">Price</p>
                                                                <p className="text-lg font-bold text-gray-900">
                                                                    ${(variant.prices[0].amount / 100).toFixed(2)}
                                                                </p>
                                                            </div>
                                                        )}
                                                        <div className="text-right">
                                                            <p className="text-xs text-gray-500 font-semibold uppercase">Stock</p>
                                                            <p className="text-2xl font-bold text-gray-900">
                                                                {variant.inventory_quantity ?? 0}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Total Inventory Summary */}
                                <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl p-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Inventory</p>
                                            <p className="text-3xl font-bold text-gray-900">{selectedProduct.display_inventory ?? 0}</p>
                                        </div>
                                        <div className="w-16 h-16 bg-gray-600 rounded-xl flex items-center justify-center">
                                            <ArchiveBox className="w-8 h-8 text-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 px-6 py-4 border-t-2 border-gray-200 flex items-center justify-between shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingProduct(selectedProduct);
                                    setSelectedProduct(null);
                                }}
                                className="px-6 py-2.5 bg-gray-900 text-white font-semibold rounded-md hover:bg-black shadow-sm transition-all text-sm flex items-center gap-2"
                            >
                                <PencilSquare className="w-4 h-4" />
                                Edit Product
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedProduct(null)}
                                className="px-6 py-2.5 bg-gray-600 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ORDER DETAIL (CLEAN UI) */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" onClick={() => setSelectedOrder(null)}></div>
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 z-50 border border-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-white z-10 shrink-0">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Order {selectedOrder.display_id}</h2>
                                <p className="text-xs text-gray-500 mt-1">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-md transition-colors">
                                <XMark />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6 overflow-y-auto text-sm">
                            {/* Status Badge in Modal */}
                            <div className="flex gap-2">
                                <span className="px-2.5 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-700 border border-gray-200">
                                    {selectedOrder.publicData.medusa_status}
                                </span>
                            </div>

                            {/* Customer */}
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Customer</p>
                                <p className="font-medium text-gray-900">{selectedOrder.decryptedData?.customerName || "Guest"}</p>
                                <p className="text-gray-500 text-xs mt-1">{selectedOrder.decryptedData?.shipping_address}</p>
                                <p className="text-gray-500 text-xs">{selectedOrder.decryptedData?.shipping_phone}</p>
                            </div>

                            {/* Items */}
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase mb-3 border-b border-gray-100 pb-2">Items</p>
                                <ul className="space-y-3">
                                    {(selectedOrder.decryptedData?.items || []).length > 0 ? (
                                        selectedOrder.decryptedData?.items.map((p: any, i: number) => (
                                            <li key={i} className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-gray-900 font-medium block">
                                                        {p.title || p.product_name}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        x{p.quantity}
                                                    </span>
                                                </div>
                                                <span className="font-medium text-gray-900">
                                                    {formatPrice(p.subtotal || (p.unit_price * p.quantity), selectedOrder.publicData.currency_code)}
                                                </span>
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-xs text-gray-400 italic text-center">Loading product details...</li>
                                    )}
                                </ul>
                            </div>

                            {/* Totals Section */}
                            <div className="border-t border-dashed border-gray-200 pt-4 space-y-2">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Subtotal</span>
                                    <span>{formatPrice(selectedOrder.decryptedData?.amount_untaxed || selectedOrder.publicData.total, selectedOrder.publicData.currency_code)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Shipping Fee</span>
                                    <span>{formatPrice(selectedOrder.decryptedData?.shipping_fee, selectedOrder.publicData.currency_code)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-base text-gray-900 mt-2 pt-2 border-t border-gray-100">
                                    <span>Total</span>
                                    <span>
                                        {formatPrice(
                                            (selectedOrder.decryptedData?.amount_untaxed || selectedOrder.publicData.total) +
                                            (selectedOrder.decryptedData?.shipping_fee || 0),
                                            selectedOrder.publicData.currency_code
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="border-t-2 border-gray-100 pt-6 pb-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Audit Trail</h3>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200">Immutable</span>
                                </div>
                                {/* Gọi component AuditTrail, truyền ID để map tên */}
                                <AuditTrail 
                                    history={selectedOrder.history || []} 
                                    sellerId={selectedOrder.seller_id}
                                    shipperId={selectedOrder.shipper_id}
                                />
                            </div>

                            {/* ACTIONS */}
                            <div className="pt-4">
                                {selectedOrder.publicData.medusa_status === 'RETURN_IN_TRANSIT' && (
                                    <button
                                        onClick={() => handleConfirmReturn(selectedOrder.id)}
                                        disabled={isConfirmingReturn === selectedOrder.id}
                                        className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-medium rounded-md shadow-sm text-sm transition-colors flex justify-center gap-2 items-center"
                                    >
                                        {isConfirmingReturn === selectedOrder.id ? <Spinner className="animate-spin" /> : <CheckCircle />}
                                        Confirm Return Received
                                    </button>
                                )}

                                {/* Thông báo chờ */}
                                {selectedOrder.publicData.medusa_status === 'RETURN_REQUESTED' && (
                                    <div className="w-full py-3 bg-yellow-50 text-yellow-700 rounded-xl text-xs font-medium text-center border border-yellow-200">
                                        Customer has requested a return. Awaiting Shipper pickup.
                                    </div>
                                )}

                                {/* Thông báo hoàn tất */}
                                {selectedOrder.publicData.medusa_status === 'RETURNED' && (
                                    <div className="w-full py-2.5 bg-gray-50 text-gray-600 rounded-md text-xs font-medium text-center border border-gray-200 flex items-center justify-center gap-2">
                                        <CheckCircle className="text-green-600" /> Return Completed
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}