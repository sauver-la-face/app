import { LegalPage, LegalSection } from '@/features/legal/components/LegalPage';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function ConfidentialitePage(props: { params: Promise<{ locale: Locale }> }) {
  const params = await props.params;
  const { legal } = getDictionary(params.locale);
  const page = legal.privacy;

  return (
    <LegalPage title={page.title} intro={page.intro} updatedAt={legal.updatedAt}>
      <LegalSection title={page.collectedTitle}>
        <p>{page.collectedIntro}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{page.collectedIdentity}</li>
          <li>{page.collectedMedical}</li>
          <li>{page.collectedPhotos}</li>
          <li>{page.collectedPhysician}</li>
          <li>{page.collectedTechnical}</li>
        </ul>
      </LegalSection>

      <LegalSection title={page.purposeTitle}>
        <p>{page.purposeBody}</p>
      </LegalSection>

      <LegalSection title={page.retentionTitle}>
        <p>{page.retentionBody}</p>
      </LegalSection>

      <LegalSection title={page.erasureTitle}>
        <p>{page.erasureBody}</p>
        <p>{page.erasureDetail}</p>
      </LegalSection>

      <LegalSection title={page.securityTitle}>
        <p>{page.securityBody}</p>
      </LegalSection>

      <LegalSection title={page.rightsTitle}>
        <p>{page.rightsBody}</p>
      </LegalSection>
    </LegalPage>
  );
}
