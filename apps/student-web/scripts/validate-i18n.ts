import { validateMessageCatalogues } from '../src/i18n';

const issues = validateMessageCatalogues();

if (issues.length > 0) {
  console.error('Translation catalogue validation failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('Translation catalogues are complete and interpolation-safe.');
