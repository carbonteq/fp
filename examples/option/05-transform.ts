import { Option } from "../../dist/option.mjs"

const age = Option.Some(25)
const adult = age.filter((a) => a >= 18)
console.log("filter:", adult.unwrap())

const numbers = Option.Some([1, 2, 3, 4])
const doubled = numbers.innerMap((n) => n * 2)
console.log("innerMap:", doubled.unwrap())

const tapped = Option.Some("hello").tap((value) => {
  console.log("tap:", value)
})

console.log("tap result:", tapped.unwrap())
