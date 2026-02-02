import { Option } from "../../dist/option.mjs";

const zipped = Option.Some(100).zip((price) => price * 0.9);
console.log("zip:", zipped.unwrap());

const fetchProductPrice = async (
  productId: string,
): Promise<Option<number>> => {
  await Promise.resolve(productId);
  return productId === "sku-1" ? Option.Some(120) : Option.None;
};

const fetchProductStock = async (price: number): Promise<Option<number>> => {
  await Promise.resolve(price);
  return price > 0 ? Option.Some(42) : Option.None;
};

const combined = await Option.Some("sku-1")
  .flatMap(fetchProductPrice)
  .flatZip(fetchProductStock)
  .toPromise();

console.log("flatZip:", combined.unwrap());
