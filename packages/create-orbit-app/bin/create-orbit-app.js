#!/usr/bin/env node
import('../dist/index.js')
  .then(({ run }) => run())
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
