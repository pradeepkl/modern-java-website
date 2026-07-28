import productPricesJson from '../../config/product-prices.json';

export type ProductFormatId = 'kindle' | 'digital' | 'paperback';

export interface ProductPrice {
  amountInr: number;
  listAmountInr: number;
}

export interface ProductPricesConfig {
  currency: 'INR';
  discountLabel: string;
  kindle: ProductPrice;
  digital: ProductPrice;
  paperback: ProductPrice;
}

export const productPrices = productPricesJson as ProductPricesConfig;

export function formatInrAmount(amountInr: number): string {
  return `₹${amountInr}`;
}

export function getProductPrice(formatId: ProductFormatId): ProductPrice {
  return productPrices[formatId];
}

export function getAmountInr(formatId: ProductFormatId): number {
  return getProductPrice(formatId).amountInr;
}

export function getListAmountInr(formatId: ProductFormatId): number {
  return getProductPrice(formatId).listAmountInr;
}

export function getFormattedPrice(formatId: ProductFormatId): string {
  return formatInrAmount(getAmountInr(formatId));
}

export function getFormattedListPrice(formatId: ProductFormatId): string {
  return formatInrAmount(getListAmountInr(formatId));
}
