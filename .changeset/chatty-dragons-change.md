---
"@carbonteq/fp": minor
---

Remove async chaining support

With the introduction of the generator methods (`gen`, `asyncGen` etc), there is no reason to support the internal async chaining methods, as using generator syntax would be much more appropriate and readable in those situations.

Removing this internal tracking would simplify the Result and option internals, allowing better maintenance and extension support.
