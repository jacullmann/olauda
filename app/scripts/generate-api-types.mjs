// Generates src/api/schema.d.ts from the server's OpenAPI description.
// `--check` fails instead of writing when the committed file is outdated.
import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';

const SPEC = new URL('../../server/openapi.json', import.meta.url);
const OUTPUT = new URL('../src/api/schema.d.ts', import.meta.url);

const HEADER = `// Generated from server/openapi.json by scripts/generate-api-types.mjs.
// Do not edit; run \`pnpm api:types\` after changing the API.\n\n`;

// Files travel as Blobs in the browser, which the default `string` hides.
const BLOB = ts.factory.createTypeReferenceNode('Blob');

const ast = await openapiTS(SPEC, {
  rootTypes: true,
  rootTypesNoSchemaPrefix: true,
  transform(schema) {
    if (schema.format === 'binary') return BLOB;
  },
});
const generated = HEADER + astToString(ast);

if (process.argv.includes('--check')) {
  // Git may check the file out with CRLF line endings on Windows.
  const committed = (await readFile(OUTPUT, 'utf8').catch(() => '')).replace(
    /\r\n/g,
    '\n',
  );
  if (committed !== generated) {
    console.error('src/api/schema.d.ts is outdated; run `pnpm api:types`.');
    process.exit(1);
  }
} else {
  await writeFile(OUTPUT, generated);
}
