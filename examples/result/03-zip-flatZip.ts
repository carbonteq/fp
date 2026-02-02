import { Result } from "../../dist/result.mjs";

const zipDemo = Result.Ok(100).zip((price) => price * 0.9);
console.log("zip:", zipDemo.unwrap());

const fetchPrice = async (
  productId: string,
): Promise<Result<number, string>> => {
  await Promise.resolve(productId);
  return productId === "sku-1" ? Result.Ok(120) : Result.Err("Unknown product");
};

const fetchStock = async (price: number): Promise<Result<number, string>> => {
  await Promise.resolve(price);
  return price > 0 ? Result.Ok(42) : Result.Err("Invalid price");
};

const combined = await Result.Ok("sku-1")
  .flatMap(fetchPrice)
  .flatZip(fetchStock)
  .toPromise();

console.log("flatZip:", combined.unwrap());
