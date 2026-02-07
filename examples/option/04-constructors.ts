import { Option } from "../../dist/option.mjs"

const findUser = (id: string): { name: string } | null =>
  id === "1" ? { name: "Alice" } : null

console.log("fromNullable:", Option.fromNullable(findUser("1")).unwrap())
console.log("fromNullable none:", Option.fromNullable(findUser("2")).isNone())

console.log("fromFalsy:", Option.fromFalsy("hello").unwrap())
console.log("fromFalsy none:", Option.fromFalsy(0).isNone())

console.log("fromPredicate:", Option.fromPredicate(25, (a) => a >= 18).unwrap())

const fetchUser = async (id: string): Promise<Option<{ name: string }>> => {
  await Promise.resolve(id)
  return id === "1" ? Option.Some({ name: "Alice" }) : Option.None
}

const userOpt = Option.fromPromise(fetchUser("1"))
const resolved = await userOpt.toPromise()
console.log("fromPromise:", resolved.unwrap())
