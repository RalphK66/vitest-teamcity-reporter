# Contributing

## Setup

```bash
nvm use
npm install
```

## Scripts

```bash
npm test          # run tests
npm run lint      # oxlint
npm run fmt       # format with oxfmt
npm run fmt:check # check formatting
npm run build     # build dist
npm run typecheck # type check without emitting
```

## Making changes

1. Fork and create a branch
2. Make your changes in `src/`
3. Add or update tests in `test/`
4. Run `npm test && npm run lint && npm run fmt:check` before committing
5. Open a PR
