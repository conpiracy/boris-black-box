export class DurableObject {
  constructor(readonly ctx: { storage: { get: () => Promise<unknown>; put: () => Promise<void> } }) {}
}
