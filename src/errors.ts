// Error classes
export class UnwrappedErrWithOk extends Error {
  constructor(result: string) {
    super(`Attempted to call unwrapErr on an Ok result: ${result}`);
    this.name = "UnwrappedErrWithOk";
  }
}

export class UnwrappedOkWithErr extends Error {
  constructor(result: string) {
    super(`Attempted to call unwrap on an Err result: ${result}`);
    this.name = "UnwrappedOkWithErr";
  }
}
