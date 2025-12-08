
// my-medusa-store/src/admin/routes/marketplace/page.tsx

import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Table, Button, Badge, toast, Text } from "@medusajs/ui";
import { Users, XCircle } from "@medusajs/icons"; 
import { useEffect, useState } from "react";

// 1. Định nghĩa Component Trang
const SellerRequestsPage = () => {
  const [sellers, setSellers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const fetchPending = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/admin/market/sellers?status=pending"); 
      const data = await res.json();
      setSellers(data.sellers || []);
    } catch (e) {
      console.error(e);
      toast.error("Loading error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (sellerId: string, shopName: string) => {
    if(!confirm("Approve this shop and create a blockchain wallet?")) return;
        
    setIsProcessing(sellerId);
    try {
      // Hiển thị toast loading
      toast.info(`Processing shop: ${shopName}...`);
      
      const res = await fetch(`/admin/market/approve-seller/${sellerId}`, { method: "POST" });
      
      if(res.ok) {
          toast.success("Success!", { description: `Wallet has been created for ${shopName}` });
          fetchPending(); // Reload list
      } else {
          const err = await res.json();
          toast.error("Failed", { description: err.error || "Unknown error" });
      }
    } catch(e) { 
        toast.error("Lỗi kết nối server"); 
    } finally {
        setIsProcessing(null);
    }
  };

  // --- HÀM TỪ CHỐI (REJECT) ---
  const handleReject = async (sellerId: string, shopName: string) => {
    if (!confirm(`Are you sure you want to DECLINE the request from "${shopName}"?`)) return;

    setIsProcessing(sellerId);
    try {
        const res = await fetch(`/admin/market/reject-seller/${sellerId}`, { method: "POST" });
        
        if (res.ok) {
            toast.success("Rejected", { description: `The request from ${shopName} has been cancelled.` });
            fetchPending();
        } else {
            toast.error("Error", { description: "Unable to reject this request." });
        }
    } catch (e) {
        toast.error("Server connection error");
    } finally {
        setIsProcessing(null);
    }
  };

  return (
    <Container className="p-0 overflow-hidden h-full min-h-[400px]">
      {/* Header của trang */}
      <div className="p-6 border-b flex justify-between items-center bg-ui-bg-base">
        <div>
            <Heading level="h1">Approve Seller</Heading>
            <Text className="text-ui-fg-subtle">List of registration requests pending approval.</Text>
        </div>
        <Badge color="grey">{sellers.length} requests</Badge>
      </div>
      
      {/* Bảng dữ liệu */}
      <div className="flex-1 overflow-auto"></div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Shop Name</Table.HeaderCell>
            <Table.HeaderCell>Register email</Table.HeaderCell>
            <Table.HeaderCell>Shop ID</Table.HeaderCell>
            <Table.HeaderCell>Phone</Table.HeaderCell>
            <Table.HeaderCell>ACtion</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {sellers.map((s) => (
            <Table.Row key={s.id} className="hover:bg-ui-bg-base-hover">
              <Table.Cell className="font-medium">{s.name}</Table.Cell>
              <Table.Cell>{s.email}</Table.Cell>
              <Table.Cell>
                <Badge
                className="font-mono text-xs bg-white border border-gray-200 text-gray-800 shadow-sm"
                >
                {s.company_code}
                </Badge>
              </Table.Cell>
              <Table.Cell>{s.phone || "-"}</Table.Cell>
              <Table.Cell>
                <div className="flex gap-2">
                    <Button 
                        size="small" 
                        variant="primary" 
                        isLoading={isProcessing === s.id}
                        disabled={isProcessing !== null}
                        onClick={() => handleApprove(s.id, s.name)}
                    >
                        Approve & Create Wallet
                    </Button>

                    {/* Nút TỪ CHỐI */}
                    <Button 
                    size="small"
                    variant="secondary"
                    disabled={isProcessing !== null}
                    className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                    onClick={() => handleReject(s.id, s.name)}
                    >
                    <XCircle /> Reject
                    </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
          
          {!isLoading && sellers.length === 0 && (
             <Table.Row>
                <td colSpan={4} className="text-center text-ui-fg-subtle p-12">
                    <Text>There are currently no requests to approve.</Text>
                </td>
             </Table.Row>
          )}
          
          {isLoading && (
             <Table.Row>
                <td colSpan={5} className="text-center p-12">
                    <div className="flex justify-center gap-2 text-ui-fg-subtle">
                        <div className="animate-spin">⟳</div> Loading...
                    </div>
                </td>
             </Table.Row>
          )}
        </Table.Body>
      </Table>
    </Container>
  );
};

// 2. Cấu hình Menu Sidebar
export const config = defineRouteConfig({
  label: "Seller Requests", // Tên hiển thị trên Menu
  icon: Users,              // Icon hiển thị (Import từ @medusajs/icons)
});

export default SellerRequestsPage;