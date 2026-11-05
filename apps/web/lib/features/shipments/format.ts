export function shipmentQuantity(quantity: string | number, uom: string | null) {
  return `${quantity} ${uom || '(birim belirtilmemiş)'}`;
}
