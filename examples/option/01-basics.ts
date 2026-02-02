import { Option } from "../../dist/option.mjs";

const some = Option.Some(5);
const none = Option.None;

console.log("some isSome:", some.isSome());
console.log("none isNone:", none.isNone());

const matched = some.match({
  Some: (value) => `Value: ${value}`,
  None: () => "No value",
});

console.log("match:", matched);
console.log("unwrapOr:", none.unwrapOr(0));
console.log("safeUnwrap:", none.safeUnwrap());
