#!/usr/bin/env node
import('../dist/index.js')
  .then(({ run }) => run())
  .catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err))
    process.exit(1)
  })
