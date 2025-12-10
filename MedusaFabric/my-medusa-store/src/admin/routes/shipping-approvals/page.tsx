import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, Heading, Table, Button, Badge, toast, Text, Toaster } from "@medusajs/ui";
import { XCircle, CheckCircle } from "@medusajs/icons"; 
import { useEffect, useState } from "react";

// [FIX 2]: Cập nhật Type đầy đủ các trường có thể có trong metadata
type ShippingUnit = {
  id: string;
  email: string;
  metadata: {
    carrier_name?: string; 
    shop_name?: string; // Thêm dòng này để fix lỗi truy cập
    phone?: string;
    company_code?: string;
    approver_status?: string;
  };
};

const ShippingApprovalsPage = () => {
  const [shippingUnits, setShippingUnits] = useState<ShippingUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const fetchPending = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/admin/shipping-units"); 
      const data = await res.json();
      setShippingUnits(data.shipping_units || []);
    } catch (e) {
      console.error(e);
      toast.error("Lỗi tải dữ liệu", { description: "Không thể lấy danh sách Shipper." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (id: string, name: string) => {
    if(!confirm(`Bạn có chắc chắn muốn DUYỆT đơn vị vận chuyển "${name}"?`)) return;
        
    setIsProcessing(id);
    try {
      toast.info(`Đang xử lý: ${name}...`);
      const res = await fetch(`/admin/shipping-units/${id}/approve`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }) 
      });
      
      if(res.ok) {
          toast.success("Thành công!", { description: `Đã duyệt đơn vị ${name}` });
          fetchPending(); 
      } else {
          const err = await res.json();
          toast.error("Thất bại", { description: err.message || "Lỗi không xác định" });
      }
    } catch(e) { 
        toast.error("Lỗi kết nối", { description: "Không thể kết nối đến server." }); 
    } finally {
        setIsProcessing(null);
    }
  };

  const handleReject = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn TỪ CHỐI và XÓA yêu cầu từ "${name}"?`)) return;

    setIsProcessing(id);
    try {
        const res = await fetch(`/admin/shipping-units/${id}/reject`, { method: "POST" });
        if (res.ok) {
            toast.success("Đã từ chối", { description: `Yêu cầu từ ${name} đã bị hủy bỏ.` });
            fetchPending();
        } else {
            const err = await res.json();
            toast.error("Lỗi", { description: err.error || "Không thể từ chối yêu cầu này." });
        }
    } catch (e) {
        toast.error("Lỗi kết nối server");
    } finally {
        setIsProcessing(null);
    }
  };

  return (
    <Container className="p-0 overflow-hidden h-full min-h-[400px]">
      <Toaster />
      
      <div className="p-6 border-b flex justify-between items-center bg-ui-bg-base">
        <div>
            <Heading level="h1">Shipping Requests</Heading>
            <Text className="text-ui-fg-subtle">Danh sách đơn vị vận chuyển đang chờ phê duyệt.</Text>
        </div>
        <Badge color="grey">{shippingUnits.length} yêu cầu</Badge>
      </div>
      
      <div className="flex-1 overflow-auto">
        <Table>
            <Table.Header>
            <Table.Row>
                <Table.HeaderCell>Carrier Name</Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Carrier Code</Table.HeaderCell>
                <Table.HeaderCell>Phone</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Hành động</Table.HeaderCell>
            </Table.Row>
            </Table.Header>
            <Table.Body>
            {shippingUnits.map((unit) => {
                const displayName = unit.metadata?.carrier_name || unit.metadata?.shop_name || unit.email;
                
                return (
                <Table.Row key={unit.id} className="hover:bg-ui-bg-base-hover">
                    <Table.Cell className="font-medium">
                        <div className="flex items-center gap-2">
                            <TruckIcon /> 
                            {displayName}
                        </div>
                    </Table.Cell>
                    <Table.Cell>{unit.email}</Table.Cell>
                    <Table.Cell>
                        <Badge className="font-mono text-xs border border-gray-200">
                            {unit.metadata?.company_code || "N/A"}
                        </Badge>
                    </Table.Cell>
                    <Table.Cell>{unit.metadata?.phone || "-"}</Table.Cell>
                    <Table.Cell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button 
                                size="small" 
                                variant="primary" 
                                isLoading={isProcessing === unit.id}
                                disabled={isProcessing !== null}
                                onClick={() => handleApprove(unit.id, displayName)}
                            >
                                <CheckCircle /> Approve
                            </Button>

                            <Button 
                                size="small"
                                variant="danger" 
                                className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                                disabled={isProcessing !== null}
                                onClick={() => handleReject(unit.id, displayName)}
                            >
                                <XCircle /> Reject
                            </Button>
                        </div>
                    </Table.Cell>
                </Table.Row>
                );
            })}
            
            {/* [FIX 3]: Dùng thẻ <tr> và <td> thay vì Table.Row/Table.Cell để dùng colSpan */}
            {!isLoading && shippingUnits.length === 0 && (
                <tr className="border-b border-ui-border-base">
                    <td colSpan={5} className="text-center text-ui-fg-subtle p-12 text-sm">
                        Hiện tại không có yêu cầu nào.
                    </td>
                </tr>
            )}
            
            {isLoading && (
                <tr className="border-b border-ui-border-base">
                    <td colSpan={5} className="text-center p-12 text-sm">
                        <div className="flex justify-center gap-2 text-ui-fg-subtle">
                            <div className="animate-spin">⟳</div> Đang tải...
                        </div>
                    </td>
                </tr>
            )}
            </Table.Body>
        </Table>
      </div>
    </Container>
  );
};

// [FIX 1]: Định nghĩa Icon thủ công (SVG) để tránh lỗi import
const TruckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ui-fg-subtle">
    <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/>
    <path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2"/>
    <circle cx="7" cy="18" r="2"/>
    <circle cx="17" cy="18" r="2"/>
  </svg>
);

export const config = defineRouteConfig({
  label: "Shipping Requests", 
  icon: TruckIcon, // Sử dụng icon custom
});

export default ShippingApprovalsPage;