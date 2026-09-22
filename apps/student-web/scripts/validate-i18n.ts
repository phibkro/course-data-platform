import { englishMessages, validateMessageCatalogues } from '../src/i18n';
import { norwegianMessages } from '../src/i18n.nb';

const issues = validateMessageCatalogues({ en: englishMessages, nb: norwegianMessages });

if (issues.length > 0) {
  console.error('Translation catalogue validation failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('Translation catalogues are complete and interpolation-safe.');
