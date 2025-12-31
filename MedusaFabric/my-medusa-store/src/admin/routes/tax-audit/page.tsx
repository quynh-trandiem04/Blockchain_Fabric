import { Container, Heading, Text, Table } from "@medusajs/ui"
import { useEffect, useState } from "react"

const TaxAuditPage = () => {
  const [data, setData] = useState<any>(null)
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resSummary = await fetch("http://192.168.245.11:3333/api/tax/summary")
        const summaryJson = await resSummary.json()
        setData(summaryJson)

        const resAll = await fetch("http://192.168.245.11:3333/api/tax/all")
        const allJson = await resAll.json()
        setAllOrders(Array.isArray(allJson) ? allJson : [])

        setLoading(false)
      } catch (err) {
        console.error("Lỗi kết nối:", err)
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading)
    return (
      <Container className="flex items-center justify-center min-h-[400px] bg-gray-50 border-0 outline-none ring-0 shadow-none">
        <div className="text-gray-500 text-lg font-medium">
          Loading Blockchain Ledger data...
        </div>
      </Container>
    )

  const filteredOrders = allOrders.filter((order) => {
    if (!search) return true
    const id = (order.key || "").toLowerCase()
    return id.includes(search.toLowerCase())
  })

  return (
    <div className="flex w-full flex-col p-3 border-0 outline-none ring-0 shadow-none">
      <Container className="p-0 bg-white min-h-screen rounded-none shadow-none ring-0 border-0">
        {/* Header */}
        <div className="p-6 border-b border-ui-border-base flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-ui-fg-base">
              Tax Audit Ledger
            </h1>
            <p className="text-sm text-ui-fg-subtle mt-1">
              Live tracking of tax compliance from Hyperledger Fabric
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-sm border border-ui-border-base rounded-md bg-ui-bg-base hover:bg-ui-bg-subtle"
          >
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mx-12 mt-4 pb-4 border-b border-gray-200">
          <div className="bg-white p-4 border border-gray-200">
            <Text className="text-xs text-gray-400 uppercase">Total Revenue</Text>
            <Heading level="h2">${(data?.totalRevenue || 0).toLocaleString()}</Heading>
          </div>
          <div className="bg-white p-4 border border-gray-200">
            <Text className="text-xs text-gray-400 uppercase">VAT (10%)</Text>
            <Heading level="h2">${(data?.totalTax || 0).toLocaleString()}</Heading>
          </div>
          <div className="bg-white p-4 border border-gray-200">
            <Text className="text-xs text-gray-400 uppercase">Audited Blocks</Text>
            <Heading level="h2">{data?.count || 0}</Heading>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white mx-12 mt-4 border-0 shadow-none ring-0">
          {/* Toolbar */}
          <div className="px-6 py-3 border-b border-ui-border-base flex items-center gap-4">
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-ui-fg-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none">
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M13.056 13.056 9.53 9.53M6.389 10.833a4.444 4.444 0 1 0 0-8.888 4.444 4.444 0 0 0 0 8.888"
                  ></path>
                </svg>
              </span>
              <input
                placeholder="Search ID"
                className="pl-9 pr-3 py-1.5 text-sm border border-ui-border-base rounded-md w-64 focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table
              className="min-w-[900px] w-full text-ui-fg-subtle
                [&_tr]:hover:!bg-transparent
                [&_thead_tr]:hover:!bg-transparent
                [&_tbody_tr]:hover:!bg-transparent
                [&_thead_tr]:border-b
                [&_thead_tr]:border-gray-200
                [&_tbody_tr]:border-y
                [&_tbody_tr]:border-gray-200
              "
            >
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Blockchain ID</Table.HeaderCell>
                  <Table.HeaderCell>Value ($)</Table.HeaderCell>
                  <Table.HeaderCell>Tax ($)</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                {filteredOrders.map((order, index) => {
                  const status = order?.details?.status || "UNKNOWN"
                  return (
                    <Table.Row key={index}>
                      {/* ID dài: truncate + hover xem full */}
                      <Table.Cell
                        title={order.key}
                        className="px-6 py-4 font-mono font-medium max-w-[320px] truncate whitespace-nowrap"
                      >
                        {order.key}
                      </Table.Cell>

                      <Table.Cell>
                        ${Number(order.details?.baseAmount || 0).toLocaleString()}
                      </Table.Cell>

                      <Table.Cell>
                        ${Number(order.taxAmount || 0).toLocaleString()}
                      </Table.Cell>

                      {/* Status: không border, chỉ chữ */}
                      <Table.Cell className="px-6 py-4">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "rgb(75, 85, 99)" }}
                        >
                          {status}
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          </div>

          <div className="p-5 bg-gray-50 border-t border-gray-200 text-center">
            <Text className="text-xs text-gray-400 italic">
              Node: 192.168.245.11 | Hyperledger Fabric v2.x | Secure Tax Audit Ledger
            </Text>
          </div>
        </div>
      </Container>
    </div>
  )
}

export default TaxAuditPage
