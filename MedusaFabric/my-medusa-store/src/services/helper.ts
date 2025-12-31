import fetch from "node-fetch";

export async function fetchTax(orderId: string) {
  const res = await fetch(`http://192.168.245.11:3333/tax/order/${orderId}`);
  if (!res.ok) throw new Error("Tax API failed");
  return res.json();
}
