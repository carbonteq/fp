import { Result } from "./dist/index.js";

const asyncOp = async (n: number) => n;

const errOp = async (_n: number): Promise<Result<string, Error>> =>
  Result.Err(new Error("test"));

const okOp = async (n: number): Promise<Result<string, Error>> =>
  Result.Ok(n.toString());

const r1 = Result.Ok(1).map(asyncOp);
console.debug("r1", r1);

const r2 = r1.flatMap(errOp);
console.debug("r2", r2);
const r2Res = await r2.unwrapErr();
console.debug("r2Res", r2Res);

const r3 = r1.flatMap(okOp);
console.debug("r3", r3);
const r3Res = await r3.unwrap();
console.debug("r3Res", r3Res);
