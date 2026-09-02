import { LegalPage, LegalSection } from '@/features/legal/components/LegalPage';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function MentionsLegalesPage(props: { params: Promise<{ locale: Locale }> }) {
  const params = await props.params;
  const { legal } = getDictionary(params.locale);
  const page = legal.notices;

  return (
    <LegalPage title={page.title} intro={page.intro} updatedAt={legal.updatedAt}>
      <LegalSection title={page.editorTitle}>
        <p>{page.editorBody}</p>
      </LegalSection>

      <LegalSection title={page.hostingTitle}>
        <p>{page.hostingBody}</p>
      </LegalSection>

      <LegalSection title={page.purposeTitle}>
        <p>{page.purposeBody}</p>
      </LegalSection>

      <LegalSection title={page.contactTitle}>
        <p>{page.contactBody}</p>
      </LegalSection>
    </LegalPage>
  );
}
